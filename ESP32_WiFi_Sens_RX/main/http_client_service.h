#pragma once
#include <stdbool.h>
#include "esp_err.h"

esp_err_t http_client_send_telemetry(const float *variances, const bool *presences, int num_nodes);