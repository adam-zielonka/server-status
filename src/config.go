package main

type Config struct {
	Plugins []string `json:"plugins"`
	Layout  string   `json:"layout"`
}

func config() any {
	return Config{
		Plugins: []string{"system", "loadAverage", "memory", "fileSystem", "network", "services", "virtualHosts"},
		Layout:  "[{\"board-3\":[{\"div\":[\"system\",\"loadAverage\"]},{\"div\":[\"memory\"]}]},{\"div\":[{\"board-2\":[{\"div\":[\"fileSystem\",\"services\"]},{\"div\":[\"network\",\"virtualHosts\"]}]}]}]",
	}
}
