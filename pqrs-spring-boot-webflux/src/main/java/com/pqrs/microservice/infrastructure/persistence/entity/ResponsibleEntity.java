package com.pqrs.microservice.infrastructure.persistence.entity;

import com.pqrs.microservice.domain.enums.ResponsibleRole;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

@Table("responsibles")
public class ResponsibleEntity {

    @Id
    private Long id;

    @Column("document")
    private String document;

    @Column("name")
    private String name;

    @Column("email")
    private String email;

    @Column("area")
    private String area;

    @Column("role")
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
