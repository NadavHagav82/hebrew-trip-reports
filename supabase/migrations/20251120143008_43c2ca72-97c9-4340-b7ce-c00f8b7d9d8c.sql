-- Add new currencies to expense_currency enum
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'BGN';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'CZK';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'HUF';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'RON';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'SEK';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'NOK';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'DKK';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'CHF';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'JPY';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'CNY';