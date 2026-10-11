#include "http_client_service.h"
#include <string.h>
#include <stdlib.h>
#include "esp_log.h"
#include "esp_http_client.h"
#include "cJSON.h"
#include "esp_wifi.h"
#include "esp_timer.h"

static const char *TAG = "HTTP_SERVICE";
#define SERVER_URL "http://DockerKoneIp:8000"
#define DEVICE_API_KEY "OMA_LAITE_AVAIN_TAHAN"

static esp_err_t http_event_handler(esp_http_client_event_t *evt) {
    if (evt->event_id == HTTP_EVENT_ON_DATA) {
        ESP_LOGD(TAG, "Response: %.*s", evt->data_len, (char*)evt->data);
    }
    return ESP_OK;
}

esp_err_t http_client_send_telemetry(const float *variances, const bool *presences, int num_nodes) {
    if (!variances || !presences || num_nodes <= 0) {
        return ESP_ERR_INVALID_ARG;
    }

    //Haetaan RSSI ja Uptime
    wifi_ap_record_t ap_info;
    int rssi = 0;
    if (esp_wifi_sta_get_ap_info(&ap_info) == ESP_OK) {
        rssi = ap_info.rssi;
    }

    int64_t uptime_s = esp_timer_get_time() / 1000000ULL;

    //Luodaan JSON
    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "device_id", "RX_S3_HUB");
    cJSON_AddNumberToObject(root, "temperature", 0.0);
    cJSON_AddNumberToObject(root, "pressure", 0.0);
    cJSON_AddNumberToObject(root, "rssi", rssi);
    cJSON_AddNumberToObject(root, "uptime_s", (double)uptime_s);

    cJSON *links = cJSON_AddArrayToObject(root, "links");
    for (int i = 0; i < num_nodes; i++) {
        cJSON *link = cJSON_CreateObject();
        cJSON_AddNumberToObject(link, "tx_id", i + 1);
        cJSON_AddNumberToObject(link, "variance", variances[i]);
        cJSON_AddBoolToObject(link, "presence", presences[i]);
        cJSON_AddItemToArray(links, link);
    }

    char *post_data = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (!post_data) {
        ESP_LOGE(TAG, "Failed to serialize JSON");
        return ESP_ERR_NO_MEM;
    }

    //Konfiguroidaan ja lähetetään HTTP POST
    esp_http_client_config_t config = {
        .url = SERVER_URL "/readings",
        .method = HTTP_METHOD_POST,
        .event_handler = http_event_handler,
        .timeout_ms = 4000,
    };
    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (!client) {
        ESP_LOGE(TAG, "Failed to initialize HTTP client");
        free(post_data);
        return ESP_FAIL;
    }

    esp_http_client_set_header(client, "Content-Type", "application/json");
    //Tarkista vastaako avain backendiin määritettyä avainta
    esp_http_client_set_header(client, "X-Device-Key", DEVICE_API_KEY);
    esp_http_client_set_post_field(client, post_data, strlen(post_data));

    esp_err_t err = esp_http_client_perform(client);
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "Telemetry dispatched. HTTP Code: %d", esp_http_client_get_status_code(client));
    } else {
        ESP_LOGE(TAG, "HTTP perform failed: %s", esp_err_to_name(err));
    }

    free(post_data);
    esp_http_client_cleanup(client);
    return err;
}