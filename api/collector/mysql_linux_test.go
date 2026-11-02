package collector

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/unix"
)

func syntheticMySQLCert(t *testing.T, withSAN bool, notBefore, notAfter time.Time) tls.Certificate {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	cert := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "Synthetic database"},
		NotBefore: notBefore, NotAfter: notAfter, KeyUsage: x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}, BasicConstraintsValid: true, IsCA: withSAN}
	if withSAN {
		cert.DNSNames = []string{"db.example.test"}
	}
	der, err := x509.CreateCertificate(rand.Reader, cert, cert, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	return tls.Certificate{Certificate: [][]byte{der}, PrivateKey: key}
}

func mysqlTestConfig(t *testing.T, cert tls.Certificate, pinned bool) (string, mysqlPrivateConfig) {
	t.Helper()
	dir := t.TempDir()
	cfg := mysqlPrivateConfig{Host: "127.0.0.1", Port: 3306, User: "synthetic-user", Database: "synthetic-schema",
		PasswordFile: filepath.Join(dir, "password")}
	// Deliberately includes whitespace, metacharacters, UTF-8 and a final newline.
	writeMySQLTestFile(t, cfg.PasswordFile, []byte(" \t'synthetic:@/\\?&=秘密\r\n"))
	if pinned {
		digest := sha256.Sum256(cert.Certificate[0])
		pin := hex.EncodeToString(digest[:])
		cfg.TLSCertSHA256 = &pin
	} else {
		cfg.TLSCAFile, cfg.TLSServerName = filepath.Join(dir, "ca.pem"), "db.example.test"
		writeMySQLTestFile(t, cfg.TLSCAFile, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: cert.Certificate[0]}))
	}
	path := filepath.Join(dir, "mysql.json")
	saveMySQLTestConfig(t, path, cfg)
	return path, cfg
}

func saveMySQLTestConfig(t *testing.T, path string, cfg mysqlPrivateConfig) {
	t.Helper()
	body, err := json.Marshal(cfg)
	if err != nil {
		t.Fatal(err)
	}
	writeMySQLTestFile(t, path, body)
}

func writeMySQLTestFile(t *testing.T, path string, body []byte) {
	t.Helper()
	if err := os.WriteFile(path, body, 0600); err != nil {
		t.Fatal(err)
	}
}

func TestMySQLPrivateConfiguration(t *testing.T) {
	cert := syntheticMySQLCert(t, true, time.Now().Add(-time.Hour), time.Now().Add(time.Hour))
	for _, pinned := range []bool{false, true} {
		path, _ := mysqlTestConfig(t, cert, pinned)
		cfg, err := mysqlDriverConfig(path)
		if err != nil {
			t.Fatal(err)
		}
		if cfg.Passwd != " \t'synthetic:@/\\?&=秘密\r\n" {
			t.Fatal("password bytes changed")
		}
		if cfg.AllowFallbackToPlaintext || cfg.MultiStatements || cfg.AllowAllFiles || cfg.AllowCleartextPasswords || cfg.AllowOldPasswords ||
			cfg.TLS == nil || cfg.TLS.MinVersion < tls.VersionTLS12 || cfg.Timeout != 5*time.Second || cfg.ReadTimeout != 5*time.Second || cfg.WriteTimeout != 5*time.Second || mysqlTotalTimeout != 12*time.Second {
			t.Fatal("unsafe connection policy")
		}
		if cfg.TLS.InsecureSkipVerify != pinned || (cfg.TLS.VerifyConnection != nil) != pinned {
			t.Fatal("pin bypass must always have mandatory verification")
		}
		if _, ok := cfg.Logger.(mysqlSilentLogger); !ok {
			t.Fatal("driver diagnostics must not leak")
		}
	}
	path, cfg := mysqlTestConfig(t, cert, false)
	body, _ := json.Marshal(cfg)
	var valid map[string]any
	if err := json.Unmarshal(body, &valid); err != nil {
		t.Fatal(err)
	}
	for name, mutate := range map[string]func(map[string]any){
		"missing host":      func(v map[string]any) { delete(v, "host") },
		"URL host":          func(v map[string]any) { v["host"] = "mysql://db.example.test" },
		"bad port":          func(v map[string]any) { v["port"] = 65536 },
		"missing port":      func(v map[string]any) { delete(v, "port") },
		"bad port type":     func(v map[string]any) { v["port"] = "3306" },
		"blank user":        func(v map[string]any) { v["user"] = " " },
		"missing schema":    func(v map[string]any) { delete(v, "database") },
		"relative password": func(v map[string]any) { v["password_file"] = "password" },
		"relative CA":       func(v map[string]any) { v["tls_ca_file"] = "ca.pem" },
		"missing name":      func(v map[string]any) { delete(v, "tls_server_name") },
		"missing CA":        func(v map[string]any) { delete(v, "tls_ca_file") },
		"name with port":    func(v map[string]any) { v["tls_server_name"] = "db.example.test:3306" },
		"no TLS":            func(v map[string]any) { delete(v, "tls_ca_file"); delete(v, "tls_server_name") },
		"mixed pin and CA":  func(v map[string]any) { v["tls_cert_sha256"] = strings.Repeat("ab", 32) },
		"mixed pin and empty CA": func(v map[string]any) {
			delete(v, "tls_server_name")
			v["tls_ca_file"] = ""
			v["tls_cert_sha256"] = strings.Repeat("ab", 32)
		},
		"mixed pin and name": func(v map[string]any) { delete(v, "tls_ca_file"); v["tls_cert_sha256"] = strings.Repeat("ab", 32) },
		"empty pin": func(v map[string]any) {
			delete(v, "tls_ca_file")
			delete(v, "tls_server_name")
			v["tls_cert_sha256"] = ""
		},
		"null pin": func(v map[string]any) { v["tls_cert_sha256"] = nil },
		"short pin": func(v map[string]any) {
			delete(v, "tls_ca_file")
			delete(v, "tls_server_name")
			v["tls_cert_sha256"] = "abcdef"
		},
		"nonhex pin": func(v map[string]any) {
			delete(v, "tls_ca_file")
			delete(v, "tls_server_name")
			v["tls_cert_sha256"] = strings.Repeat("z", 64)
		},
		"skip verify":          func(v map[string]any) { v["insecure_skip_verify"] = true },
		"fallback":             func(v map[string]any) { v["allow_fallback_to_plaintext"] = true },
		"SQL injection option": func(v map[string]any) { v["query"] = "SELECT synthetic" },
	} {
		t.Run(name, func(t *testing.T) {
			v := make(map[string]any, len(valid))
			for k, value := range valid {
				v[k] = value
			}
			mutate(v)
			body, _ := json.Marshal(v)
			writeMySQLTestFile(t, path, body)
			if _, err := loadMySQLConfig(path); err != errQuery {
				t.Fatalf("invalid config error: %v", err)
			}
		})
	}
	for _, body := range []string{"null", "[]", "{}", string(body) + " {}", strings.Repeat(" ", mysqlConfigLimit+1)} {
		writeMySQLTestFile(t, path, []byte(body))
		if _, err := loadMySQLConfig(path); err != errQuery {
			t.Fatalf("accepted invalid JSON/size: %v", err)
		}
	}
}

func TestMySQLPrivateFileBounds(t *testing.T) {
	cert := syntheticMySQLCert(t, true, time.Now().Add(-time.Hour), time.Now().Add(time.Hour))
	path, cfg := mysqlTestConfig(t, cert, false)
	if err := os.Chmod(path, 0640); err != nil {
		t.Fatal(err)
	}
	if _, err := mysqlDriverConfig(path); err != errQuery {
		t.Fatal("accepted nonprivate config")
	}
	if err := os.Chmod(path, 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(cfg.PasswordFile, 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := mysqlDriverConfig(path); err != errQuery {
		t.Fatal("accepted nonprivate password")
	}
	if err := os.Chmod(cfg.PasswordFile, 0600); err != nil {
		t.Fatal(err)
	}
	writeMySQLTestFile(t, cfg.PasswordFile, bytes.Repeat([]byte("x"), mysqlPasswordLimit+1))
	if _, err := mysqlDriverConfig(path); err != errQuery {
		t.Fatal("accepted oversized password")
	}
	writeMySQLTestFile(t, cfg.PasswordFile, nil) // Exact empty passwords are permitted too.
	if drv, err := mysqlDriverConfig(path); err != nil || drv.Passwd != "" {
		t.Fatal("empty password altered")
	}
	for _, body := range [][]byte{[]byte("not a certificate"), bytes.Repeat([]byte("x"), mysqlCALimit+1)} {
		writeMySQLTestFile(t, cfg.TLSCAFile, body)
		if _, err := mysqlDriverConfig(path); err != errQuery {
			t.Fatal("accepted invalid/oversized CA")
		}
	}
	fifo := filepath.Join(t.TempDir(), "fifo")
	if err := unix.Mkfifo(fifo, 0600); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"relative", fifo, t.TempDir(), filepath.Join(t.TempDir(), "missing")} {
		if _, err := readMySQLFile(path, 1024, true); err != errQuery {
			t.Fatal("accepted nonregular/missing file")
		}
	}
}

func TestDatabaseKinds(t *testing.T) {
	base := Config{SnapshotFile: "/private/snapshot", StateFile: "/private/state", SampleInterval: 60, DirectoryInterval: 900, GitHubInterval: 300}
	for _, kind := range []string{"", "postgres", "mysql", "mariadb"} {
		item := Database{Name: "Example", Kind: kind, LimitBytes: 100}
		if kind == "mysql" || kind == "mariadb" {
			item.MySQLConfigFile = "/private/mysql.json"
		} else {
			item.Service, item.ServiceFile = "example", "/private/pg_service.conf"
		}
		base.Databases = []Database{item}
		if err := base.Validate(); err != nil {
			t.Fatalf("rejected %q: %v", kind, err)
		}
	}
	for _, item := range []Database{
		{Name: "Example", Kind: "mysql", LimitBytes: 100},
		{Name: "Example", Kind: "mysql", MySQLConfigFile: "relative", LimitBytes: 100},
		{Name: "Example", Kind: "mysql", MySQLConfigFile: "/private/mysql.json", Service: "example", LimitBytes: 100},
		{Name: "Example", Kind: "mysql", MySQLConfigFile: "/private/mysql.json", LimitBytes: 0},
		{Name: "Example", Kind: "postgres", MySQLConfigFile: "/private/mysql.json", Service: "example", ServiceFile: "/private/service", LimitBytes: 100},
		{Name: "Example", Kind: "unknown", LimitBytes: 100},
	} {
		base.Databases = []Database{item}
		if err := base.Validate(); err == nil {
			t.Fatal("accepted invalid kind/config")
		}
	}
}

// Minimal synthetic MySQL wire peer: tests exercise the real driver's handshake,
// TLS upgrade and SQL instead of mocking database/sql. It never accesses a DB.
type mysqlWireOptions struct {
	maxTLSVersion             uint16
	stallAt                   string
	noTLS, stall              bool
	failAt                    string
	size, connections, cipher any
}
type mysqlWireObserved struct {
	queries       []string
	authenticated bool
	err           error
}

func startMySQLWire(t *testing.T, cert tls.Certificate, opts mysqlWireOptions) (int, <-chan mysqlWireObserved) {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { listener.Close() })
	done := make(chan mysqlWireObserved, 1)
	go func() {
		seen := mysqlWireObserved{}
		defer func() { done <- seen }()
		conn, err := listener.Accept()
		listener.Close()
		if err != nil {
			seen.err = err
			return
		}
		defer conn.Close()
		conn.SetDeadline(time.Now().Add(3 * time.Second))
		if opts.stall {
			io.Copy(io.Discard, conn)
			return
		}
		caps := uint32(1 | 4 | 8 | 512 | 8192 | 32768 | 1<<19)
		if !opts.noTLS {
			caps |= 2048
		}
		hello := append([]byte{10}, []byte("8.0.0-synthetic\x00")...)
		hello = append(hello, 42, 0, 0, 0)
		hello = append(hello, []byte("12345678\x00")...)
		hello = append(hello, byte(caps), byte(caps>>8), 45, 2, 0, byte(caps>>16), byte(caps>>24), 21)
		hello = append(hello, make([]byte, 10)...)
		hello = append(hello, []byte("abcdefghijkl\x00mysql_native_password\x00")...)
		if wireWrite(conn, 0, hello) != nil {
			return
		}
		request, err := wireRead(conn)
		if err != nil {
			return
		} // Expected for absent TLS.
		if len(request) != 32 || binary.LittleEndian.Uint32(request)&2048 == 0 {
			seen.err = fmt.Errorf("credentials before TLS")
			return
		}
		secured := tls.Server(conn, &tls.Config{Certificates: []tls.Certificate{cert}, MinVersion: tls.VersionTLS10, MaxVersion: opts.maxTLSVersion})
		if secured.Handshake() != nil {
			return
		} // Expected for rejected certificates.
		conn = secured
		if _, err = wireRead(conn); err != nil {
			return
		}
		seen.authenticated = true
		if opts.failAt == "auth" {
			wireError(conn, 3)
			return
		}
		if wireWrite(conn, 3, []byte{0, 0, 0, 2, 0, 0, 0}) != nil {
			return
		}
		for {
			packet, err := wireRead(conn)
			if err != nil || len(packet) == 0 || packet[0] == 1 {
				return
			}
			if packet[0] != 3 {
				seen.err = fmt.Errorf("unexpected command %d", packet[0])
				return
			}
			query := string(packet[1:])
			seen.queries = append(seen.queries, query)
			if query == opts.stallAt {
				io.Copy(io.Discard, conn)
				return
			}
			if query == opts.failAt {
				wireError(conn, 1)
				continue
			}
			switch query {
			case "START TRANSACTION READ ONLY", "ROLLBACK":
				err = wireWrite(conn, 1, []byte{0, 0, 0, 2, 0, 0, 0})
			case mysqlSizeQuery:
				err = wireResult(conn, []string{"bytes"}, []any{opts.size})
			case mysqlConnectionsQuery:
				err = wireResult(conn, []string{"connections"}, []any{opts.connections})
			case mysqlTLSQuery:
				err = wireResult(conn, []string{"Variable_name", "Value"}, []any{"Ssl_cipher", opts.cipher})
			default:
				seen.err = fmt.Errorf("unapproved SQL: %s", query)
				return
			}
			if err != nil {
				return
			}
		}
	}()
	return listener.Addr().(*net.TCPAddr).Port, done
}

func wireWrite(conn net.Conn, seq byte, body []byte) error {
	_, err := conn.Write(append([]byte{byte(len(body)), byte(len(body) >> 8), byte(len(body) >> 16), seq}, body...))
	return err
}
func wireRead(conn net.Conn) ([]byte, error) {
	var header [4]byte
	if _, err := io.ReadFull(conn, header[:]); err != nil {
		return nil, err
	}
	size := int(header[0]) | int(header[1])<<8 | int(header[2])<<16
	if size > 65536 {
		return nil, fmt.Errorf("oversized synthetic request")
	}
	body := make([]byte, size)
	_, err := io.ReadFull(conn, body)
	return body, err
}
func wireError(conn net.Conn, seq byte) {
	wireWrite(conn, seq, append([]byte{255, 0x28, 0x04, '#'}, []byte("HY000 private-server-error-sentinel")...))
}
func wireResult(conn net.Conn, names []string, values []any) error {
	seq := byte(1)
	write := func(body []byte) error { err := wireWrite(conn, seq, body); seq++; return err }
	if err := write([]byte{byte(len(names))}); err != nil {
		return err
	}
	for _, name := range names {
		field := []byte{3, 'd', 'e', 'f', 0, 0, 0, byte(len(name))}
		field = append(field, name...)
		field = append(field, 0, 12, 45, 0, 255, 0, 0, 0, 0xfd, 0, 0, 0, 0, 0)
		if err := write(field); err != nil {
			return err
		}
	}
	if err := write([]byte{254, 0, 0, 2, 0}); err != nil {
		return err
	}
	var row []byte
	for _, value := range values {
		if value == nil {
			row = append(row, 251)
			continue
		}
		text := fmt.Sprint(value)
		row = append(row, byte(len(text)))
		row = append(row, text...)
	}
	if err := write(row); err != nil {
		return err
	}
	return write([]byte{254, 0, 0, 2, 0})
}

func awaitMySQLWire(t *testing.T, done <-chan mysqlWireObserved) mysqlWireObserved {
	t.Helper()
	select {
	case seen := <-done:
		if seen.err != nil {
			t.Fatal(seen.err)
		}
		return seen
	case <-time.After(4 * time.Second):
		t.Fatal("synthetic peer did not close")
		return mysqlWireObserved{}
	}
}

func TestMySQLCollectionVerifiedTLSAndReadOnly(t *testing.T) {
	for _, pinned := range []bool{false, true} {
		for _, size := range []int64{0, 85, 99} {
			t.Run(fmt.Sprintf("pin=%v/size=%d", pinned, size), func(t *testing.T) {
				// Pin mode deliberately exercises a self-signed, no-SAN leaf.
				cert := syntheticMySQLCert(t, !pinned, time.Now().Add(-time.Hour), time.Now().Add(time.Hour))
				path, cfg := mysqlTestConfig(t, cert, pinned)
				port, done := startMySQLWire(t, cert, mysqlWireOptions{size: size, connections: 3, cipher: "SYNTHETIC-CIPHER"})
				cfg.Port = port
				saveMySQLTestConfig(t, path, cfg)
				item := Database{Name: "Example database", Kind: "mysql", MySQLConfigFile: path, LimitBytes: 100}
				result := (sampler{}).databases(context.Background(), []Database{item})[0]
				wantStatus := "healthy"
				if size >= 95 {
					wantStatus = "failure"
				} else if size >= 80 {
					wantStatus = "warning"
				}
				if result["status"] != wantStatus || result["bytes"] != size || result["connections"] != 3 || result["tls"] != true || result["available_bytes"] != 100-size {
					t.Fatalf("unexpected metrics: %v", result)
				}
				seen := awaitMySQLWire(t, done)
				want := []string{"START TRANSACTION READ ONLY", mysqlSizeQuery, mysqlConnectionsQuery, mysqlTLSQuery, "ROLLBACK"}
				if !seen.authenticated || !reflect.DeepEqual(seen.queries, want) {
					t.Fatalf("unexpected query plan: %v", seen)
				}
				assertMySQLRedacted(t, result, cfg)
			})
		}
	}
}

func assertMySQLRedacted(t *testing.T, result row, cfg mysqlPrivateConfig) {
	t.Helper()
	body, err := json.Marshal(result)
	if err != nil {
		t.Fatal(err)
	}
	for _, private := range []string{cfg.Host, cfg.PasswordFile, cfg.User, cfg.Database, "private-server-error-sentinel", "synthetic:@", "SYNTHETIC-CIPHER"} {
		if strings.Contains(string(body), private) {
			t.Fatalf("private data in row: %s", body)
		}
	}
	if cfg.TLSCertSHA256 != nil && strings.Contains(string(body), *cfg.TLSCertSHA256) {
		t.Fatal("pin leaked")
	}
}

func TestMySQLFailureUnknownAndRedacted(t *testing.T) {
	for _, failure := range []string{"auth", "START TRANSACTION READ ONLY", mysqlSizeQuery, mysqlConnectionsQuery, mysqlTLSQuery, "ROLLBACK", "null size", "negative size", "overflow size", "invalid size", "null connections", "zero connections", "negative connections", "null cipher", "empty cipher"} {
		t.Run(failure, func(t *testing.T) {
			cert := syntheticMySQLCert(t, false, time.Now().Add(-time.Hour), time.Now().Add(time.Hour))
			path, cfg := mysqlTestConfig(t, cert, true)
			opts := mysqlWireOptions{size: 0, connections: 1, cipher: "SYNTHETIC-CIPHER", failAt: failure}
			switch failure {
			case "null size":
				opts.size = nil
			case "negative size":
				opts.size = -1
			case "overflow size":
				opts.size = "18446744073709551615"
			case "invalid size":
				opts.size = "private-server-error-sentinel"
			case "null connections":
				opts.connections = nil
			case "zero connections":
				opts.connections = 0
			case "negative connections":
				opts.connections = -1
			case "null cipher":
				opts.cipher = nil
			case "empty cipher":
				opts.cipher = ""
			}
			port, done := startMySQLWire(t, cert, opts)
			cfg.Port = port
			saveMySQLTestConfig(t, path, cfg)
			result := (sampler{}).databases(context.Background(), []Database{{Name: "Example", Kind: "mariadb", MySQLConfigFile: path, LimitBytes: 100}})[0]
			if result["status"] != "unknown" || result["bytes"] != nil || result["connections"] != nil || result["tls"] != nil || result["error"] != "Database metrics are unavailable" {
				t.Fatalf("failed query reported metrics: %v", result)
			}
			assertMySQLRedacted(t, result, cfg)
			awaitMySQLWire(t, done)
		})
	}
}

func TestMySQLTLSRejectionBeforeAuthentication(t *testing.T) {
	for _, failure := range []string{"wrong pin", "expired pin", "future pin", "invalid self-signature pin", "wrong CA", "wrong name", "no SAN with CA", "absent TLS pinned", "absent TLS CA", "old TLS pinned", "old TLS CA"} {
		t.Run(failure, func(t *testing.T) {
			pinned := strings.Contains(failure, "pin")
			before, after := time.Now().Add(-time.Hour), time.Now().Add(time.Hour)
			if failure == "expired pin" {
				before, after = before.Add(-24*time.Hour), time.Now().Add(-time.Hour)
			}
			if failure == "future pin" {
				before, after = time.Now().Add(time.Hour), time.Now().Add(24*time.Hour)
			}
			cert := syntheticMySQLCert(t, !pinned && failure != "no SAN with CA", before, after)
			if failure == "invalid self-signature pin" {
				cert.Certificate[0][len(cert.Certificate[0])-1] ^= 1
			}
			path, cfg := mysqlTestConfig(t, cert, pinned)
			switch failure {
			case "wrong pin":
				pin := strings.Repeat("00", 32)
				cfg.TLSCertSHA256 = &pin
			case "wrong CA":
				other := syntheticMySQLCert(t, true, before, after)
				writeMySQLTestFile(t, cfg.TLSCAFile, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: other.Certificate[0]}))
			case "wrong name":
				cfg.TLSServerName = "other.example.test"
			}
			opts := mysqlWireOptions{noTLS: strings.HasPrefix(failure, "absent TLS")}
			if strings.HasPrefix(failure, "old TLS") {
				opts.maxTLSVersion = tls.VersionTLS11
			}
			port, done := startMySQLWire(t, cert, opts)
			cfg.Port = port
			saveMySQLTestConfig(t, path, cfg)
			data, err := collectMySQL(context.Background(), path)
			if err != errQuery || data.Bytes != nil {
				t.Fatalf("accepted unsafe TLS: %v %v", data, err)
			}
			seen := awaitMySQLWire(t, done)
			if seen.authenticated || len(seen.queries) != 0 {
				t.Fatal("credentials/queries sent on rejected channel")
			}
		})
	}
}

func TestMySQLDeadline(t *testing.T) {
	for _, phase := range []string{"greeting", "query"} {
		t.Run(phase, func(t *testing.T) {
			cert := syntheticMySQLCert(t, false, time.Now().Add(-time.Hour), time.Now().Add(time.Hour))
			path, cfg := mysqlTestConfig(t, cert, true)
			opts := mysqlWireOptions{stall: phase == "greeting"}
			if phase == "query" {
				opts.stallAt = mysqlSizeQuery
			}
			port, done := startMySQLWire(t, cert, opts)
			cfg.Port = port
			saveMySQLTestConfig(t, path, cfg)
			ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
			defer cancel()
			start := time.Now()
			if _, err := collectMySQL(ctx, path); err != errQuery {
				t.Fatal("stalled peer accepted")
			}
			if time.Since(start) > time.Second {
				t.Fatal("parent deadline not respected")
			}
			awaitMySQLWire(t, done)
		})
	}
}
