package com.pqrs.microservice.infrastructure.persistence.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDate;

@Table("answers")
public class AnswerEntity {

    @Id
    private Long id;

    @Column("content")
    private String content;

    @Column("answer_date")
    private LocalDate answerDate;

    @Column("author_id")
    private Long authorId;

    @Transient
    private ResponsibleEntity author;

    protected AnswerEntity() {
    }

    public AnswerEntity(String content, LocalDate answerDate, ResponsibleEntity author) {
        this.content = content;
        this.answerDate = answerDate;
        this.author = author;
        this.authorId = author == null ? null : author.getId();
    }

    public Long getId() { return id; }
    public String getContent() { return content; }
    public LocalDate getAnswerDate() { return answerDate; }
    public Long getAuthorId() { return authorId; }
    public ResponsibleEntity getAuthor() { return author; }
    public void attachAuthor(ResponsibleEntity author) { this.author = author; }
}
