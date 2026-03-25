-- Executar no pgAdmin (database: ghorg_requests_db) ou:
-- docker exec -i ghorg-requests-postgres psql -U ghorg_api_svc -d ghorg_requests_db -f -

-- Apaga todos os pedidos de scrape (PostgreSQL)
TRUNCATE TABLE ghorg_scrape_requests RESTART IDENTITY;

-- MongoDB (Compass / mongosh): database ghorg_scrape_warehouse
-- db.ghorg_organization_profiles.deleteMany({})
