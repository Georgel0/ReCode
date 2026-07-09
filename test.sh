#!/bin/bash

# --- CONFIGURATION ---
BASE_URL="http://localhost:3000" # Update if testing against a live deployment
MOCK_ID="XiGLWXHg"
MOCK_URL="$BASE_URL/m/$MOCK_ID"

echo "=================================================="
echo "🚀 STARTING LIVE MOCK SERVER SMOKE TESTS"
echo "Targeting: $MOCK_URL"
echo "=================================================="

echo -e "\n--- 1. Param Extraction (GET /api/products/1) ---"
# Expects 200 and the specific product object for ID '1'
curl -s "$MOCK_URL/api/products/1"

echo -e "\n\n--- 2. Query/Pagination Match (GET /api/products?category=Apparel&perPage=1) ---"
# Expects 200 and a paginated envelope containing only Apparel items
curl -s "$MOCK_URL/api/products?category=Apparel&perPage=1"

echo -e "\n\n--- 3. Auth Rejection (POST /api/products without Bearer) ---"
# Expects 401 Unauthorized
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "$MOCK_URL/api/products" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "price": 10, "sku": "123"}'

echo -e "\n--- 4. Validation Failure (POST /api/products missing fields) ---"
# Expects 422 ValidationError (missing price and sku)
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "$MOCK_URL/api/products" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{"name": "Incomplete Product"}'

echo -e "\n--- 5. Persistence / Successful Creation (POST /api/products) ---"
# Expects 201 Created and the new product object
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "$MOCK_URL/api/products" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Gaming Mouse", "price": 59.99, "sku": "MOUSE-001", "stock": 15}'

echo -e "\n--- 6. Auth-Protected Cart Fetch (GET /api/cart) ---"
# Expects 200 and the cart object
curl -s "$MOCK_URL/api/cart" -H "Authorization: Bearer test-token"

echo -e "\n\n--- 7. Cart Update (PUT /api/cart) ---"
# Expects 200 and the updated cart object with the new total calculated
curl -s -X PUT "$MOCK_URL/api/cart" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"productId": "3", "quantity": 2, "unitPrice": 59.99}]}'

echo -e "\n\n--- 8. Rate Limiting Check (60 Rapid Requests) ---"
# Expects the first 50 to return 200, and the last 10 to return 429
echo "Hammering GET /api/products/1..."
for i in {1..60}; do 
  curl -s -o /dev/null -w "%{http_code} " "$MOCK_URL/api/products/1"
done
echo ""

echo -e "\n--- 9. Payload Cap Test (~3MB payload) ---"
# Expects 413 Payload Too Large
head -c 3000000 /dev/urandom | base64 | curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "$MOCK_URL/api/products" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  --data-binary @- -o -

echo -e "\n=================================================="
echo "✅ TESTS COMPLETE"
echo "=================================================="
