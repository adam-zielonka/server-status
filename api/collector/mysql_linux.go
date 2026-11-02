package collector

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/tls"
	"crypto/x509"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"io"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"golang.org/x/sys/unix"
)

const (
	mysqlConnectTimeout = 5 * time.Second
	mysqlIOTimeout      = 5 * time.Second
	mysqlTotalTimeout   = 12 * time.Second
	mysqlConfigLimit    = 16 * 1024
	mysqlPasswordLimit  = 64 * 1024
	mysqlCALimit        = 1024 * 1024

	// NULL statistics are not an empty database. Views have no storage of their
	// own; other table types (including MariaDB versioned tables) are included.
	mysqlSizeQuery = `SELECT CASE WHEN COUNT(*) = COUNT(DATA_LENGTH) AND COUNT(*) = COUNT(INDEX_LENGTH)
THEN COALESCE(SUM(DATA_LENGTH + INDEX_LENGTH), 0) ELSE NULL END
FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE <> 'VIEW'`
	// Scope stays at the current session's username even with PROCESS privilege.
	// Do not select query text, client addresses or any table contents.
	mysqlConnectionsQuery = `SELECT COUNT(*) FROM information_schema.PROCESSLIST
WHERE DB = DATABASE() AND USER = (SELECT USER FROM information_schema.PROCESSLIST WHERE ID = CONNECTION_ID())`
	mysqlTLSQuery = `SHOW SESSION STATUS LIKE 'Ssl_cipher'`
)

// Private input only: never serialize this structure into telemetry or logs.
type mysqlPrivateConfig struct {
	Host          string  `json:"host"`
	Port          int     `json:"port"`
	User          string  `json:"user"`
	Database      string  `json:"database"`
	PasswordFile  string  `json:"password_file"`
	TLSCAFile     string  `json:"tls_ca_file,omitempty"`
	TLSServerName string  `json:"tls_server_name,omitempty"`
	TLSCertSHA256 *string `json:"tls_cert_sha256,omitempty"`
}

// O_NONBLOCK prevents named pipes/devices from blocking before the regular-file
// check. The cap applies during reading too, so growth cannot bypass it.
func readMySQLFile(path string, limit int64, private bool) ([]byte, error) {
	if !filepath.IsAbs(path) {
		return nil, errQuery
	}
	fd, err := unix.Open(path, unix.O_RDONLY|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, errQuery
	}
	f := os.NewFile(uintptr(fd), path)
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() || info.Size() > limit || private && info.Mode().Perm()&0077 != 0 {
		return nil, errQuery
	}
	body, err := io.ReadAll(io.LimitReader(f, limit+1))
	if err != nil || int64(len(body)) > limit {
		return nil, errQuery
	}
	return body, nil
}

func loadMySQLConfig(path string) (mysqlPrivateConfig, error) {
	body, err := readMySQLFile(path, mysqlConfigLimit, true)
	if err != nil {
		return mysqlPrivateConfig{}, errQuery
	}
	var cfg mysqlPrivateConfig
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&cfg) != nil || decoder.Decode(new(any)) != io.EOF {
		return mysqlPrivateConfig{}, errQuery
	}
	// A present null or empty pin is an error, never an implicit switch of mode.
	var fields map[string]json.RawMessage
	if json.Unmarshal(body, &fields) != nil || fields == nil {
		return mysqlPrivateConfig{}, errQuery
	}
	_, hasPin := fields["tls_cert_sha256"]
	_, hasCA := fields["tls_ca_file"]
	_, hasName := fields["tls_server_name"]
	if !validMySQLHost(cfg.Host) || cfg.Port < 1 || cfg.Port > 65535 ||
		strings.TrimSpace(cfg.User) == "" || strings.ContainsRune(cfg.User, 0) ||
		strings.TrimSpace(cfg.Database) == "" || strings.ContainsRune(cfg.Database, 0) || !filepath.IsAbs(cfg.PasswordFile) {
		return mysqlPrivateConfig{}, errQuery
	}
	if hasPin {
		if cfg.TLSCertSHA256 == nil || hasCA || hasName {
			return mysqlPrivateConfig{}, errQuery
		}
		pin, err := hex.DecodeString(*cfg.TLSCertSHA256)
		if err != nil || len(pin) != sha256.Size {
			return mysqlPrivateConfig{}, errQuery
		}
	} else if !filepath.IsAbs(cfg.TLSCAFile) || !validMySQLHost(cfg.TLSServerName) {
		return mysqlPrivateConfig{}, errQuery
	}
	return cfg, nil
}

func validMySQLHost(host string) bool {
	return net.ParseIP(host) != nil || hostPattern.MatchString(host)
}

func mysqlTLSConfig(cfg mysqlPrivateConfig) (*tls.Config, error) {
	policy := &tls.Config{MinVersion: tls.VersionTLS12}
	if cfg.TLSCertSHA256 != nil {
		pin, err := hex.DecodeString(*cfg.TLSCertSHA256)
		if err != nil || len(pin) != sha256.Size || cfg.TLSCAFile != "" || cfg.TLSServerName != "" {
			return nil, errQuery
		}
		// Exact leaf pinning replaces standard PKI/hostname verification for a
		// self-signed leaf with no SAN. This bypass is never user configurable.
		policy.InsecureSkipVerify = true
		policy.VerifyConnection = func(state tls.ConnectionState) error {
			if state.Version < tls.VersionTLS12 || len(state.PeerCertificates) == 0 {
				return errQuery
			}
			cert := state.PeerCertificates[0]
			digest := sha256.Sum256(cert.Raw)
			now := time.Now()
			if subtle.ConstantTimeCompare(digest[:], pin) != 1 || now.Before(cert.NotBefore) || now.After(cert.NotAfter) ||
				!bytes.Equal(cert.RawIssuer, cert.RawSubject) || cert.CheckSignature(cert.SignatureAlgorithm, cert.RawTBSCertificate, cert.Signature) != nil {
				return errQuery
			}
			return nil
		}
		return policy, nil
	}
	if !validMySQLHost(cfg.TLSServerName) {
		return nil, errQuery
	}
	body, err := readMySQLFile(cfg.TLSCAFile, mysqlCALimit, false)
	if err != nil {
		return nil, errQuery
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(body) {
		return nil, errQuery
	}
	policy.RootCAs, policy.ServerName = roots, cfg.TLSServerName
	return policy, nil
}

// Suppress the driver's diagnostic logger too: wire/server errors can contain
// private addresses or text. All failures cross the collector boundary generically.
type mysqlSilentLogger struct{}

func (mysqlSilentLogger) Print(...any) {}

func mysqlDriverConfig(path string) (*mysql.Config, error) {
	private, err := loadMySQLConfig(path)
	if err != nil {
		return nil, errQuery
	}
	password, err := readMySQLFile(private.PasswordFile, mysqlPasswordLimit, true)
	if err != nil {
		return nil, errQuery
	}
	policy, err := mysqlTLSConfig(private)
	if err != nil {
		return nil, errQuery
	}
	cfg := mysql.NewConfig()
	cfg.Net, cfg.Addr = "tcp", net.JoinHostPort(private.Host, strconv.Itoa(private.Port))
	// Password files contain the submitted bytes, not a line to trim or unquote.
	cfg.User, cfg.Passwd, cfg.DBName = private.User, string(password), private.Database
	cfg.TLS = policy
	cfg.Timeout, cfg.ReadTimeout, cfg.WriteTimeout = mysqlConnectTimeout, mysqlIOTimeout, mysqlIOTimeout
	cfg.Logger = mysqlSilentLogger{}
	cfg.MaxAllowedPacket = 1024 * 1024
	// No DSN, configurable SQL, plaintext fallback or multi-statements.
	return cfg, nil
}

func collectMySQL(parent context.Context, path string) (databaseMetrics, error) {
	ctx, cancel := context.WithTimeout(parent, mysqlTotalTimeout)
	defer cancel()
	cfg, err := mysqlDriverConfig(path)
	if err != nil {
		return databaseMetrics{}, errQuery
	}
	connector, err := mysql.NewConnector(cfg)
	if err != nil {
		return databaseMetrics{}, errQuery
	}
	db := sql.OpenDB(connector)
	defer db.Close()
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(0)
	tx, err := db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return databaseMetrics{}, errQuery
	}
	defer tx.Rollback()
	var size int64
	var connections int
	var variable, cipher string
	if tx.QueryRowContext(ctx, mysqlSizeQuery).Scan(&size) != nil || size < 0 ||
		tx.QueryRowContext(ctx, mysqlConnectionsQuery).Scan(&connections) != nil || connections < 1 ||
		tx.QueryRowContext(ctx, mysqlTLSQuery).Scan(&variable, &cipher) != nil || variable != "Ssl_cipher" || strings.TrimSpace(cipher) == "" {
		return databaseMetrics{}, errQuery
	}
	// Rollback closes this read-only transaction; a failed close is not success.
	if tx.Rollback() != nil || ctx.Err() != nil {
		return databaseMetrics{}, errQuery
	}
	encrypted := true
	return databaseMetrics{Bytes: &size, Connections: &connections, TLS: &encrypted}, nil
}
