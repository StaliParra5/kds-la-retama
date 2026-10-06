# Multi-stage Dockerfile para KDS Backend (La Retama Restaurante)
# Etapa 1: Compilación con Maven y Eclipse Temurin 21 (Alpine ligero)
FROM maven:3.9-eclipse-temurin-21-alpine AS builder
WORKDIR /app

# Aprovechar caché de capas de Docker para dependencias Maven
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Compilar código fuente y ejecutar suite de pruebas unitarias
COPY src ./src
RUN mvn clean package -B

# Etapa 2: Imagen final mínima para ejecución on-premise en mini PC
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Crear usuario sin privilegios de root por principios de ciberseguridad
RUN addgroup -S kdsgroup && adduser -S kdsuser -G kdsgroup
USER kdsuser

COPY --from=builder /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
