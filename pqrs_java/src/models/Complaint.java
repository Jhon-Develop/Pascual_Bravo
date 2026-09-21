package models;

public class Complaint extends PQRS {
    public Complaint(String description, Citizen citizen){
        super(description, citizen);
    }

    @Override
    public int getMaximumAnswerDays() { return 5; }
    
}
