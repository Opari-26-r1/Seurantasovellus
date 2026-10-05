idf_component_register(SRCS "main.c" "http_client_service.c"
                    INCLUDE_DIRS "."
                    REQUIRES esp_wifi nvs_flash esp_event esp_timer esp_netif cjson esp_http_client log)
