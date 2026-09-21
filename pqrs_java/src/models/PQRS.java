package models;

import interfaces.Manageable;
import enums.StatePQRS;
import java.time.LocalDate;

public abstract class PQRS implements Manageable {
    private static int residentAccountant = 1000;

    private String reference;
    private String description;
    private StatePQRS state;
    private LocalDate CretedDate;
    private LocalDate LimmitedDate;

    private Citizen citizen;
    private Responsible responsible;

    private Answer answer;
    
    public PQRS(String description, Citizen citizen){
        if (description == null || description.trim().isEmpty()){
            throw new IllegalArgumentException("PQRS description cannot be null or empty");
        }
        if (citizen == null){
            throw new IllegalArgumentException("PQRS citizen cannot be null");
        }
        this.description = description;
        this.citizen = citizen;
        this.state = StatePQRS.RADICADA;
        this.CretedDate = LocalDate.now();
        this.reference = "RAD-" + LocalDate.now().getYear() + "-" + (++residentAccountant);
        this.LimmitedDate = this.CretedDate.plusDays(getMaximumAnswerDays());
    }

    public abstract int getMaximumAnswerDays();

    @Override 
    public void assignResponsible(Responsible responsible) {
        if (responsible == null){
            throw new IllegalArgumentException("PQRS responsible cannot be null");
        }
        this.responsible = responsible;
        this.state = StatePQRS.ASIGNADA;
    }

    @Override 
    public void putIntoManagement() {
        if (this.responsible == null){
            throw new IllegalStateException("VIOLATED BUSINESS RULE: A request must be assigned to a person in charge before moving to 'In Progress'.");
        }
        this.state = StatePQRS.EN_GESTION;
    }

    @Override
    public void recordResponse(Answer answer) {
        if (this.state != StatePQRS.EN_GESTION && this.state != StatePQRS.ASIGNADA){
            throw new IllegalStateException("The PQRS must be under processing or assigned in order to record a response.");
        }
        if (answer == null){
            throw new IllegalArgumentException("The provided response is invalid.");
        }
        this.answer = answer;
        this.state = StatePQRS.RESPONDIDA;
    }

    @Override
    public void closeCase() {
        if (this.answer == null){
            throw new IllegalStateException("VIOLATED BUSINESS RULE: A PQRS cannot be closed without a recorded response.");
        }
        this.state = StatePQRS.CERRADA;
    }

    public void simulateCreationDateAndLimit(LocalDate simulateCreationDate, LocalDate simulateLimitDate){
        this.CretedDate = simulateCreationDate;
        this.LimmitedDate = simulateLimitDate;
    }

    public String getReference() { return reference;}
    public String getDescription() { return description;}
    public StatePQRS getState() { return state;}
    public LocalDate getCretedDate() { return CretedDate;}
    public LocalDate getLimmitedDate() { return LimmitedDate;}
    public Citizen getCitizen() { return citizen;}
    public Responsible getResponsible() { return responsible;}
    public Answer getAnswer() { return answer;}
}
