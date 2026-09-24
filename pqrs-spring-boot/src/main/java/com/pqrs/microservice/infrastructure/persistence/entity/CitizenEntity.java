package com.pqrs.microservice.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "citizens")
public class CitizenEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String document;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 150)
    private String email;

    @Column(length = 30)
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
