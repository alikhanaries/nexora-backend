# Infrastructure Configs

This folder contains **deployment-adjacent configuration files** for local observability — not application source code (that lives in `src/infrastructure/`).

## Contents

```
infrastructure/
└── observability/
    ├── otel-collector.yaml    OpenTelemetry Collector pipeline
    └── prometheus.yml         Prometheus scrape config
```

## Usage

Observability services are behind the Docker Compose **`observability` profile** so developers are not forced to run Prometheus for everyday API work.

```bash
# Core stack only (postgres, redis, minio)
docker compose up -d

# Include Prometheus + OTel Collector
docker compose --profile observability up -d
```

| Service        | Port             | Config file                         |
| -------------- | ---------------- | ----------------------------------- |
| OTel Collector | 4318 (OTLP HTTP) | `observability/otel-collector.yaml` |
| Prometheus     | 9090             | `observability/prometheus.yml`      |

## Enabling tracing in the app

With the observability profile running:

```env
TRACING_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
OTEL_SERVICE_NAME=nexora-backend
```

Restart the API after changing environment variables.

## Prometheus

Default config scrapes the Nexora metrics endpoint. With API running and `METRICS_ENABLED=true`:

- Metrics URL: http://localhost:3000/metrics
- Prometheus UI: http://localhost:9090

Adjust scrape targets in `prometheus.yml` if the API port or host differs.

## Production note

These files are **development references**. Production deployments should use managed observability (Grafana Cloud, Datadog, AWS AMP, etc.) with environment-specific configs maintained in the deployment repository or IaC — not copied verbatim from here.

## Related

- [docker-compose.yml](../docker-compose.yml)
- [docs/operations/README.md](../docs/operations/README.md)
- [src/infrastructure/observability/](../src/infrastructure/observability/) — application tracing and metrics code
