.PHONY: web
web: ## Build and package web assets
	mkdir -p web
	cd frontend && npm install && npm run build
	tar -czf web.static.tar.gz -C frontend/build .
	mv web.static.tar.gz web/

.PHONY: web-test
web-test: web
	cd web && tar -xzf web.static.tar.gz && rm web.static.tar.gz
	cd web && william.toolbox.frontend