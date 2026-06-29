# Tiny static Go image for the Early Atlas authoring service (ADR 0005).
# Multi-stage: build a CGO-free static binary, ship it on distroless/static.
# Result is a ~12 MB image, nonroot, no shell — minimal footprint on the shared EC2.

FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/authoring .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/authoring /authoring
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/authoring"]
