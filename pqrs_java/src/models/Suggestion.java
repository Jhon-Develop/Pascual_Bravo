package models;

public class Suggestion extends PQRS {
    public Suggestion(String description, Citizen citizen){
        super(description, citizen);
    }

    @Override
    public int getMaximumAnswerDays() { return 10; }
    
}
