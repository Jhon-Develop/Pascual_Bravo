package services;

import enums.StatePQRS;
import models.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class PQRSService {
    private List<PQRS> repositoryPQRS;

    public PQRSService(){
        this.repositoryPQRS = new ArrayList<>();
    }

    public String RegisterPQRS(PQRS pqrs){
        if (pqrs == null){
            throw new IllegalArgumentException("PQRS cannot be null");
        }
        repositoryPQRS.add(pqrs);
        return pqrs.getReference();
    }

    public PQRS findByReference(String reference){
        return repositoryPQRS.stream()
                             .filter(pqrs -> pqrs.getReference().equalsIgnoreCase(reference))
                             .findFirst()
                             .orElse(null);
    }

    public void AssignResponsible(String reference, Responsible responsible){
        PQRS pqrs = findByReference(reference);
        if (pqrs == null){
            throw new IllegalArgumentException("PQRS with reference " + reference + " not found");
        }
        pqrs.assignResponsible(responsible);
    }

    public void PassToManagement(String reference){
        PQRS pqrs = findByReference(reference);
        if (pqrs == null){
            throw new IllegalArgumentException("PQRS with reference " + reference + " not found");
        }
        pqrs.putIntoManagement();
    }

    public void answerPQRS(String reference, String message, Responsible author){
        PQRS pqrs = findByReference(reference);
        if (pqrs == null){
            throw new IllegalArgumentException("The PQRS with reference " + reference + " not found");
        }
        Answer answer = new Answer(message, author);
        pqrs.recordResponse(answer);
    }

    public void CloseCase(String reference){
        PQRS pqrs = findByReference(reference);
        if (pqrs == null){
            throw new IllegalArgumentException("The PQRS with reference " + reference + " not found");
        }
        pqrs.closeCase();
    }

    public List<PQRS> getExpiredCases(){
        LocalDate today = LocalDate.now();
        return repositoryPQRS.stream()
                             .filter(pqrs -> pqrs.getState() != StatePQRS.CERRADA && today.isAfter(pqrs.getLimmitedDate()))
                             .collect(Collectors.toList());
    }

    public List<String> generateAlertsSupervisor(){
        List<PQRS> expired = getExpiredCases();
        List<String> alerts = new ArrayList<>();
        for (PQRS pqrs : expired){
            String area = (pqrs.getResponsible() != null) ? pqrs.getResponsible().getArea() : "N/A";
            alerts.add("ALERT SUPERVISOR - Expired Case: [" + pqrs.getReference() + "] Area: " + area + "| It Expired on: " + pqrs.getLimmitedDate());
        }
        return alerts;
    }

    public List<PQRS> getAllCases(){
        return new ArrayList<>(repositoryPQRS);
    }

}

