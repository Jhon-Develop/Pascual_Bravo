package models;

public class Claim extends PQRS {
    public Claim(String description, Citizen citizen){
        super(description, citizen);
    }

    @Override
    public int getMaximumAnswerDays() { return 5; }
    
}
