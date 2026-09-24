package com.pqrs.microservice.infrastructure.persistence.entity;

import com.pqrs.microservice.domain.enums.ResponsibleRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "responsibles")
public class ResponsibleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String document;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 150)
    private String email;

    @Column(nullable = false, length = 100)
    private String area;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ResponsibleRole role;

    protected ResponsibleEntity() {
    }

    public ResponsibleEntity(
            String document,
            String name,
            String email,
            String area,
            ResponsibleRole role
    ) {
        this.document = document;
        this.name = name;
        this.email = email;
        this.area = area;
        this.role = role;
    }

    public Long getId() { return id; }
    public String getDocument() { return document; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getArea() { return area; }
    public ResponsibleRole getRole() { return role; }

    public void updateFrom(String name, String email, String area, ResponsibleRole role) {
        this.name = name;
        this.email = email;
        this.area = area;
        this.role = role;
    }
}
