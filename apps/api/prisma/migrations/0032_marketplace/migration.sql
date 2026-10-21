-- 0032_marketplace (BE-46): marketplace_categories, marketplace_sellers, marketplace_products,
-- marketplace_product_images, marketplace_reviews (M20 buyer slice). Hand-written in the style of
-- 0008_curriculum: identity columns, CHECK constraints (enums are text + check), foreign keys.
-- Legacy columns only on the two tables that can receive .cloud rows (sellers, products).

CREATE TABLE "marketplace_categories" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,

    CONSTRAINT "marketplace_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketplace_sellers" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "shop_name" TEXT NOT NULL,
    "description" TEXT,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "whatsapp_clicks" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "marketplace_sellers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketplace_products" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "seller_id" BIGINT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category_id" BIGINT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "original_price" DECIMAL(10,2),
    "description" TEXT,
    "condition" TEXT NOT NULL,
    "stock_status" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "shipping_method" TEXT NOT NULL,
    "shipping_fee" DECIMAL(10,2),
    "location" TEXT NOT NULL DEFAULT '',
    "views" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "marketplace_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketplace_product_images" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "product_id" BIGINT NOT NULL,
    "position" SMALLINT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "marketplace_product_images_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketplace_reviews" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "product_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "rating" SMALLINT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_reviews_pkey" PRIMARY KEY ("id")
);

-- Unique keys and indexes
CREATE UNIQUE INDEX "uq_marketplace_categories_slug" ON "marketplace_categories"("slug");
CREATE UNIQUE INDEX "uq_marketplace_sellers_user_id" ON "marketplace_sellers"("user_id");
CREATE UNIQUE INDEX "uq_marketplace_sellers_legacy" ON "marketplace_sellers"("legacy_source", "legacy_id");
CREATE INDEX "ix_marketplace_sellers_status" ON "marketplace_sellers"("status");
CREATE UNIQUE INDEX "uq_marketplace_products_slug" ON "marketplace_products"("slug");
CREATE UNIQUE INDEX "uq_marketplace_products_legacy" ON "marketplace_products"("legacy_source", "legacy_id");
CREATE INDEX "ix_marketplace_products_status_category_id" ON "marketplace_products"("status", "category_id");
CREATE INDEX "ix_marketplace_products_seller_id" ON "marketplace_products"("seller_id");
CREATE INDEX "ix_marketplace_products_created_at_id" ON "marketplace_products"("created_at" DESC, "id");
CREATE UNIQUE INDEX "uq_marketplace_product_images_product_position" ON "marketplace_product_images"("product_id", "position");
CREATE INDEX "ix_marketplace_reviews_product_id_created_at" ON "marketplace_reviews"("product_id", "created_at" DESC);

-- Foreign keys
ALTER TABLE "marketplace_sellers" ADD CONSTRAINT "fk_marketplace_sellers_user_id"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketplace_products" ADD CONSTRAINT "fk_marketplace_products_seller_id"
  FOREIGN KEY ("seller_id") REFERENCES "marketplace_sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketplace_products" ADD CONSTRAINT "fk_marketplace_products_category_id"
  FOREIGN KEY ("category_id") REFERENCES "marketplace_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketplace_product_images" ADD CONSTRAINT "fk_marketplace_product_images_product_id"
  FOREIGN KEY ("product_id") REFERENCES "marketplace_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_reviews" ADD CONSTRAINT "fk_marketplace_reviews_product_id"
  FOREIGN KEY ("product_id") REFERENCES "marketplace_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_reviews" ADD CONSTRAINT "fk_marketplace_reviews_user_id"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraints (enums are text + check, plan 14.2)
ALTER TABLE "marketplace_sellers" ADD CONSTRAINT "ck_marketplace_sellers_legacy_source"
  CHECK (legacy_source IS NULL OR legacy_source IN ('cloud', 'my'));
ALTER TABLE "marketplace_sellers" ADD CONSTRAINT "ck_marketplace_sellers_status"
  CHECK (status IN ('pending', 'active', 'suspended', 'banned'));
ALTER TABLE "marketplace_sellers" ADD CONSTRAINT "ck_marketplace_sellers_whatsapp_clicks"
  CHECK (whatsapp_clicks >= 0);
ALTER TABLE "marketplace_products" ADD CONSTRAINT "ck_marketplace_products_legacy_source"
  CHECK (legacy_source IS NULL OR legacy_source IN ('cloud', 'my'));
ALTER TABLE "marketplace_products" ADD CONSTRAINT "ck_marketplace_products_condition"
  CHECK (condition IN ('new', 'used'));
ALTER TABLE "marketplace_products" ADD CONSTRAINT "ck_marketplace_products_stock_status"
  CHECK (stock_status IN ('available', 'out_of_stock'));
ALTER TABLE "marketplace_products" ADD CONSTRAINT "ck_marketplace_products_status"
  CHECK (status IN ('active', 'draft', 'rejected'));
ALTER TABLE "marketplace_products" ADD CONSTRAINT "ck_marketplace_products_shipping_method"
  CHECK (shipping_method IN ('pickup', 'postage', 'cod', 'free'));
ALTER TABLE "marketplace_products" ADD CONSTRAINT "ck_marketplace_products_prices"
  CHECK (price >= 0 AND (original_price IS NULL OR original_price >= 0) AND (shipping_fee IS NULL OR shipping_fee >= 0));
ALTER TABLE "marketplace_products" ADD CONSTRAINT "ck_marketplace_products_views"
  CHECK (views >= 0);
ALTER TABLE "marketplace_product_images" ADD CONSTRAINT "ck_marketplace_product_images_position"
  CHECK (position >= 1);
ALTER TABLE "marketplace_reviews" ADD CONSTRAINT "ck_marketplace_reviews_rating"
  CHECK (rating BETWEEN 1 AND 5);
