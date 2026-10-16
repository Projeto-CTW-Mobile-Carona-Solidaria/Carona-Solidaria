FROM node:24-bookworm-slim AS panel
WORKDIR /build/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
ENV VITE_API_URL=""
RUN npm run build -- --base=/admin/

FROM node:24-bookworm-slim AS mobile
WORKDIR /build/mobile
COPY mobile/package.json mobile/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY mobile/ ./
ENV CI=1 EXPO_NO_TELEMETRY=1 EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=""
RUN npm run typecheck && npx expo export --platform web

FROM maven:3.9-eclipse-temurin-17 AS backend
WORKDIR /build
COPY pom.xml ./
COPY backend/pom.xml backend/pom.xml
RUN mvn -B -pl backend dependency:go-offline
COPY backend/src backend/src
COPY --from=mobile /build/mobile/dist/ backend/src/main/resources/static/
COPY --from=panel /build/web/dist/ backend/src/main/resources/static/admin/
RUN mvn -B -pl backend package

FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
RUN groupadd --system app && useradd --system --gid app app
COPY --from=backend --chown=app:app /build/backend/target/backend-1.0.0.jar app.jar
USER app
ENV SPRING_PROFILES_ACTIVE=cloud PORT=8079
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60.0 -XX:+UseSerialGC -Xss512k"
EXPOSE 8079
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
