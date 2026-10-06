package com.pqrs.microservice.infrastructure.persistence.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

@Table("citizens")
public class CitizenEntity {

    @Id
    private Long id;

    @Column("document")
    private String document;

    @Column("name")
    private String name;

    @Column("email")
    private String email;

    @Column("phone")
    private String phone;

    protected CitizenEntity() {
    }

    public CitizenEntity(String document, String name, String email, String phone) {
        this.document = document;
        this.name = name;
        this.email = email;
        this.phone = phone;
    }

    public Long getId() { return id; }
    public String getDocument() { return document; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getPhone() { return phone; }

    public void updateFrom(String name, String email, String phone) {
        this.name = name;
        this.email = email;
        this.phone = phone;
    }
}
