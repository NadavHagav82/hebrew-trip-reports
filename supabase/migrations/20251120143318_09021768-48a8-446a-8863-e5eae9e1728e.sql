-- Add all new currencies to expense_currency enum

-- European currencies
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'ISK';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'HRK';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'RSD';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'UAH';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'TRY';

-- Latin American currencies
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'CAD';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'MXN';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'BRL';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'ARS';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'CLP';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'COP';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'PEN';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'UYU';

-- Far East currencies
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'KRW';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'HKD';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'SGD';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'THB';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'MYR';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'IDR';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'PHP';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'VND';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'TWD';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'INR';

-- African currencies
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'ZAR';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'EGP';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'MAD';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'TND';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'KES';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'NGN';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'GHS';

-- Australia and Oceania currencies
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'AUD';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'NZD';

-- Middle East currencies
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'AED';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'SAR';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'QAR';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'KWD';
ALTER TYPE expense_currency ADD VALUE IF NOT EXISTS 'JOD';