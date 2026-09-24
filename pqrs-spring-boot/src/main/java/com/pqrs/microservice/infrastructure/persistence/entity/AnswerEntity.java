package com.pqrs.microservice.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDate;

@Entity
@Table(name = "answers")
public class AnswerEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 5000)
    private String content;

    @Column(nullable = false)
    private LocalDate answerDate;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private ResponsibleEntity author;

    protected AnswerEntity() {
    }

    public AnswerEntity(String content, LocalDate answerDate, ResponsibleEntity author) {
        this.content = content;
        this.answerDate = answerDate;
        this.author = author;
    }

    public String getContent() { return content; }
    public LocalDate getAnswerDate() { return answerDate; }
    public ResponsibleEntity getAuthor() { return author; }
}
