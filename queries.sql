CREATE TABLE books (
    id VARCHAR(30) PRIMARY KEY,          -- Supports all types of book IDs
    title VARCHAR(100) NOT NULL,
    summary VARCHAR(500),
    image_url TEXT,
    author VARCHAR(100),
    
    rating NUMERIC(2,1) NOT NULL CHECK (rating BETWEEN 0 AND 5),
    link TEXT NOT NULL                   -- Purchase or reference URL
);

