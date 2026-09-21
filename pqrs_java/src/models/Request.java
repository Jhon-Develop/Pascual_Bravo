package models;

public class Request extends PQRS {
    public Request(String description, Citizen citizen){
        super(description, citizen);
    }

    @Override
    public int getMaximumAnswerDays() { return 15;}
}
