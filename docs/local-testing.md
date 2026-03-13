# Local Docker Testing

This guide provides minimal instructions for building and testing the Docker image locally with PostgreSQL.

## 1. Build the Docker Image

Ensure the Docker daemon is running on your machine. Then, from the project root, execute:

```bash
./docker-build.sh
```

This command builds the image and tags it as `stage-flow-tools`.

## 2. Prepare the Environment

```bash
cp .env.example .env
docker compose up -d postgres
```

Verify `DATABASE_URL`, `NUXT_JWT_SECRET`, and the admin credentials in `.env`.

## 3. Run the Container

To test the built image, run the following command. It mounts the local `.env` file and the `data` directory into the container for optional predefined question imports.

```bash
docker run --rm -it \
  -p 3000:3000 \
  --env-file ./.env \
  --network thorsten-stage-flow-tools_default \
  -v "$(pwd)/data:/app/data" \
  --name test-stage-flow \
  stage-flow-tools
```

The application will be available at `http://localhost:3000`. The container will be automatically removed when you stop it (`Ctrl+C`).
