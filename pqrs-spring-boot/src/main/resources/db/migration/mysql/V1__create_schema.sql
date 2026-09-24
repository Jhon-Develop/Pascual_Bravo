CREATE TABLE citizens (
    id BIGINT NOT NULL AUTO_INCREMENT,
    document VARCHAR(30) NOT NULL,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(30),
    PRIMARY KEY (id),
    UNIQUE KEY uk_citizens_document (document)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE responsibles (
    id BIGINT NOT NULL AUTO_INCREMENT,
    document VARCHAR(30) NOT NULL,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(150),
    area VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_responsibles_document (document)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE answers (
    id BIGINT NOT NULL AUTO_INCREMENT,
    content VARCHAR(5000) NOT NULL,
    answer_date DATE NOT NULL,
    author_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_answers_author FOREIGN KEY (author_id) REFERENCES responsibles(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pqrs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    reference VARCHAR(30),
    type VARCHAR(20) NOT NULL,
    description VARCHAR(5000) NOT NULL,
    state VARCHAR(20) NOT NULL,
    created_date DATE NOT NULL,
    limited_date DATE NOT NULL,
    citizen_id BIGINT NOT NULL,
    responsible_id BIGINT,
    answer_id BIGINT,
    PRIMARY KEY (id),
    UNIQUE KEY uk_pqrs_reference (reference),
    UNIQUE KEY uk_pqrs_answer (answer_id),
    KEY idx_pqrs_state_limited_date (state, limited_date),
    KEY idx_pqrs_citizen (citizen_id),
    KEY idx_pqrs_responsible (responsible_id),
    CONSTRAINT fk_pqrs_citizen FOREIGN KEY (citizen_id) REFERENCES citizens(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pqrs_responsible FOREIGN KEY (responsible_id) REFERENCES responsibles(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_pqrs_answer FOREIGN KEY (answer_id) REFERENCES answers(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
