package models;

import java.time.LocalDate;

public class Answer {
    private String content;
    private LocalDate answerDate;
    private Responsible author;

    public Answer(String content, Responsible author){
        if (content == null || content.trim().isEmpty()){
            throw new IllegalArgumentException("Answer content cannot be null or empty");
        }
        if (author == null){
            throw new IllegalArgumentException("Answer author cannot be null");
        }
        this.content = content;
        this.author = author;
        this.answerDate = LocalDate.now();
    }

    public String getContent() { return content;}
    public LocalDate getAnswerDate() { return answerDate;}
    public Responsible getAuthor() { return author;}
}
