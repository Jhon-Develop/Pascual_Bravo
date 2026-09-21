// import enums.StatePQRS;
// import models.*;
// import services.PQRSService;

// import java.time.LocalDate;
// import java.util.List;

// public class Main {
//     public static void main(String[] args) {
//         System.out.println("|---------------------------------------------------------------------------------|");
//         System.out.println("|                                                                                 |");
//         System.out.println("|                 PQRS MANAGEMENT AND TRACKING SYSTEM (JAVA)                      |");
//         System.out.println("|                                                                                 |");
//         System.out.println("|---------------------------------------------------------------------------------|");

//         PQRSService apiService = new PQRSService();

//         Citizen citizen = new Citizen("101823948", "Carlos Mendoza", "carlos@gmail.com", "3001234567");
//         Responsible analyst = new Responsible("987654321", "Ana Gomez", "ana.gomez@empresa.com", "Soporte Tecnico", false);
//         Responsible supervisor = new Responsible("112233445", "Roberto Silva", "roberto.silva@empresa.com", "Soporte Tecnico", true);

//         System.out.println("|---------------------------------------------------------------------------------|");
//         System.out.println("|                                                                                 |");
//         System.out.println("|            1. REGISTRATION OF PQRS AND CALCULATION OF DEADLINES                 |");
//         System.out.println("|                                                                                 |");
//         System.out.println("|---------------------------------------------------------------------------------|");

//         PQRS complaint = new Complaint("The service experienced intermittent issues over the weekend.", citizen);
//         PQRS claim = new Claim("Solicito copia digital de mi contrato de suscripción.", citizen);

//         String complaintReference = apiService.RegisterPQRS(complaint);
//         String claimReference = apiService.RegisterPQRS(claim);

//         System.out.println("Complaint Reference: " + complaintReference + "| State: " + complaint.getState() + "| Limited Date: " + complaint.getLimmitedDate());
//         System.out.println("Claim Reference: " + claimReference + "| State: " + claim.getState() + "| Limited Date: " + claim.getLimmitedDate());

//         System.out.println("|---------------------------------------------------------------------------------|");
//         System.out.println("|                                                                                 |");
//         System.out.println("|                         2. BUSINESS RULE VALIDATION TEST                        |");  
//         System.out.println("|                                                                                 |");
//         System.out.println("|---------------------------------------------------------------------------------|");

//         try {
//             System.out.println("Attempting to switch to 'In Progress' without assigning a person in charge...");
//             apiService.PassToManagement(claimReference);
//         } catch (IllegalStateException e){
//             System.out.println("CORRECTLY CAPTURED:" + e.getMessage());
//         }

//         System.out.println("|---------------------------------------------------------------------------------|");
//         System.out.println("|                                                                                 |");
//         System.out.println("|                 3. ASSIGNMENT OF RESPONSIBLE AND PROGRESS OF PQRS               |");
//         System.out.println("|                                                                                 |");
//         System.out.println("|---------------------------------------------------------------------------------|");

//         apiService.AssignResponsible(complaintReference, analyst);
//         System.out.println("Responsible assigned: " + complaint.getResponsible().getName() + " (" + complaint.getResponsible().getArea() + ")");
//         System.out.println("New State: " + complaint.getState());

//         apiService.PassToManagement(complaintReference);
//         System.out.println("Updated State to: " + complaint.getState());

//         try{
//             System.out.println("Attempting to close the case without recording a response...");
//             apiService.CloseCase(complaintReference);
//         } catch (IllegalStateException e){
//             System.out.println("CORRECTLY CAPTURED:" + e.getMessage());
//         }

//         System.out.println("|---------------------------------------------------------------------------------|");
//         System.out.println("|                                                                                 |");
//         System.out.println("|                       4. RESPONSE RECORDING AND CLOSURE                         |");
//         System.out.println("|                                                                                 |");
//         System.out.println("|---------------------------------------------------------------------------------|");

//         apiService.answerPQRS(complaintReference, "Preventive maintenance was performed on the sector node. Service restored.", analyst);
//         System.out.println("Response recorded by: " + complaint.getAnswer().getAuthor().getName() + "in date: " + complaint.getAnswer().getAnswerDate());
//         System.out.println("Case State: " + complaint.getState());

//         apiService.CloseCase(complaintReference);
//         System.out.println("Case successfully closed. Final Status: " + complaint.getState());

//         System.out.println("|---------------------------------------------------------------------------------|");
//         System.out.println("|                                                                                 |");
//         System.out.println("|               5. MONITORING OF EXPIRED TIMEFRAMES AND ALERTS                    |");
//         System.out.println("|                                                                                 |");
//         System.out.println("|---------------------------------------------------------------------------------|");

//         PQRS expiredComplaint = new Complaint("Incorrect billing for the current period.", citizen);
//         expiredComplaint.simulateCreationDateAndLimit(LocalDate.now().minusDays(15), LocalDate.now().minusDays(5));
//         apiService.RegisterPQRS(expiredComplaint);
//         apiService.AssignResponsible(expiredComplaint.getReference(), analyst);

//         List<String> alerts = apiService.generateAlertsSupervisor();
//         System.out.println("Alerts generated to: " + supervisor.getName() + " (" + supervisor.getRol() + "):");
//         for (String alert : alerts){
//             System.out.println(" - " + alert);
//         }

//         System.out.println("|---------------------------------------------------------------------------------|");
//         System.out.println("|                                                                                 |");
//         System.out.println("|                EXECUTION COMPLETED SUCCESSFULLY WITHOUT ERRORS.                 |");
//         System.out.println("|                                                                                 |");
//         System.out.println("|---------------------------------------------------------------------------------|");
//     }
// }


import enums.StatePQRS;
import models.*;
import services.PQRSService;

import java.time.LocalDate;
import java.util.List;
import java.util.Scanner;

public class Main {
    private static PQRSService apiService = new PQRSService();
    private static Scanner scanner = new Scanner(System.in);

    // Default staff users for management assignment
    private static Responsible analyst = new Responsible("987654321", "Ana Gomez", "ana.gomez@empresa.com", "Soporte Tecnico", false);
    private static Responsible supervisor = new Responsible("112233445", "Roberto Silva", "roberto.silva@empresa.com", "Soporte Tecnico", true);

    public static void main(String[] args) {
        boolean running = true;

        while (running) {
            printHeader("PQRS MANAGEMENT AND TRACKING SYSTEM (JAVA)");
            System.out.println("| 1. REGISTER NEW PQRS (CITIZEN)                                                  |");
            System.out.println("| 2. CONSULT PQRS STATUS BY REFERENCE                                             |");
            System.out.println("| 3. ASSIGN RESPONSIBLE & PASS TO MANAGEMENT                                      |");
            System.out.println("| 4. RECORD ANSWER & CLOSE CASE                                                   |");
            System.out.println("| 5. MONITOR EXPIRED TIMEFRAMES AND ALERTS (SUPERVISOR)                           |");
            System.out.println("| 6. RUN FULL AUTOMATED TEST FLOW                                                 |");
            System.out.println("| 0. EXIT SYSTEM                                                                  |");
            System.out.println("|---------------------------------------------------------------------------------|");
            System.out.print("Select an option [0-6]: ");

            String option = scanner.nextLine().trim();

            switch (option) {
                case "1":
                    registerPQRSInteractive();
                    break;
                case "2":
                    consultPQRSInteractive();
                    break;
                case "3":
                    assignAndManageInteractive();
                    break;
                case "4":
                    answerAndCloseInteractive();
                    break;
                case "5":
                    viewAlertsInteractive();
                    break;
                case "6":
                    runAutomatedTestFlow();
                    break;
                case "0":
                    running = false;
                    printHeader("EXITING SYSTEM - THANK YOU!");
                    break;
                default:
                    System.out.println("\n[!] Invalid option. Please try again.\n");
            }
        }
        scanner.close();
    }

    // ---------------------------------------------------------------------------------
    // INTERACTIVE OPTIONS (REAL TERMINAL INPUT)
    // ---------------------------------------------------------------------------------

    private static void registerPQRSInteractive() {
        printHeader("1. REGISTRATION OF PQRS AND CALCULATION OF DEADLINES");

        System.out.println("Enter Citizen Information:");
        System.out.print(" -> Citizen ID / Document: ");
        String id = scanner.nextLine();

        System.out.print(" -> Full Name: ");
        String name = scanner.nextLine();

        System.out.print(" -> Email: ");
        String email = scanner.nextLine();

        System.out.print(" -> Phone: ");
        String phone = scanner.nextLine();

        Citizen citizen = new Citizen(id, name, email, phone);

        System.out.println("\nSelect Request Type:");
        System.out.println(" 1. Complaint (Queja) - 5 Days Deadline");
        System.out.println(" 2. Claim (Petición/Reclamo) - 15 Days Deadline");
        System.out.print(" Option [1-2]: ");
        String typeOpt = scanner.nextLine().trim();

        System.out.print(" -> Enter detailed description: ");
        String description = scanner.nextLine();

        PQRS newPqrs;
        if (typeOpt.equals("1")) {
            newPqrs = new Complaint(description, citizen);
        } else {
            newPqrs = new Claim(description, citizen);
        }

        String reference = apiService.RegisterPQRS(newPqrs);

        System.out.println("\n[✓] REGISTRATION SUCCESSFUL:");
        System.out.println(" -> Reference Code : " + reference);
        System.out.println(" -> Initial State  : " + newPqrs.getState());
        System.out.println(" -> Limited Date   : " + newPqrs.getLimmitedDate());
        System.out.println();
    }

    private static void consultPQRSInteractive() {
        printHeader("CONSULT PQRS STATUS BY REFERENCE");
        System.out.print("Enter Reference Code (e.g. RAD-2026-1001): ");
        String reference = scanner.nextLine().trim();

        PQRS pqrs = apiService.findByReference(reference);

        if (pqrs == null) {
            System.out.println("\n[X] No PQRS record found with reference: " + reference + "\n");
        } else {
            System.out.println("\n--- CASE DETAILS ---");
            System.out.println("Reference    : " + pqrs.getReference());
            System.out.println("Citizen      : " + pqrs.getCitizen().getName() + " (" + pqrs.getCitizen().getEmail() + ")");
            System.out.println("Description  : " + pqrs.getDescription());
            System.out.println("State        : " + pqrs.getState());
            System.out.println("Creation Date: " + pqrs.getCretedDate());
            System.out.println("Limited Date : " + pqrs.getLimmitedDate());

            if (pqrs.getResponsible() != null) {
                System.out.println("Responsible  : " + pqrs.getResponsible().getName() + " [" + pqrs.getResponsible().getArea() + "]");
            } else {
                System.out.println("Responsible  : Unassigned");
            }

            if (pqrs.getAnswer() != null) {
                System.out.println("Answer       : " + pqrs.getAnswer().getContent());
                System.out.println("Answer Date  : " + pqrs.getAnswer().getAnswerDate());
            }
            System.out.println();
        }
    }

    private static void assignAndManageInteractive() {
        printHeader("3. ASSIGNMENT OF RESPONSIBLE AND PROGRESS OF PQRS");
        System.out.print("Enter Reference Code: ");
        String reference = scanner.nextLine().trim();

        PQRS pqrs = apiService.findByReference(reference);

        if (pqrs == null) {
            System.out.println("\n[X] Record not found.\n");
            return;
        }

        apiService.AssignResponsible(reference, analyst);
        System.out.println("Responsible assigned: " + pqrs.getResponsible().getName() + " (" + pqrs.getResponsible().getArea() + ")");
        System.out.println("New State: " + pqrs.getState());

        try {
            apiService.PassToManagement(reference);
            System.out.println("Updated State to: " + pqrs.getState());
        } catch (IllegalStateException e) {
            System.out.println("CORRECTLY CAPTURED: " + e.getMessage());
        }
        System.out.println();
    }

    private static void answerAndCloseInteractive() {
        printHeader("4. RESPONSE RECORDING AND CLOSURE");
        System.out.print("Enter Reference Code: ");
        String reference = scanner.nextLine().trim();

        PQRS pqrs = apiService.findByReference(reference);

        if (pqrs == null) {
            System.out.println("\n[X] Record not found.\n");
            return;
        }

        System.out.print("Enter response content: ");
        String responseText = scanner.nextLine();

        apiService.answerPQRS(reference, responseText, analyst);
        if (pqrs.getAnswer() != null) {
            System.out.println("Response recorded by: " + pqrs.getAnswer().getAuthor().getName() + " in date: " + pqrs.getAnswer().getAnswerDate());
            System.out.println("Case State: " + pqrs.getState());
        }

        try {
            apiService.CloseCase(reference);
            System.out.println("Case successfully closed. Final Status: " + pqrs.getState());
        } catch (IllegalStateException e) {
            System.out.println("CORRECTLY CAPTURED: " + e.getMessage());
        }
        System.out.println();
    }

    private static void viewAlertsInteractive() {
        printHeader("5. MONITORING OF EXPIRED TIMEFRAMES AND ALERTS");
        List<String> alerts = apiService.generateAlertsSupervisor();

        System.out.println("Alerts generated to: " + supervisor.getName() + " (" + supervisor.getRol() + "):");
        if (alerts.isEmpty()) {
            System.out.println(" - No expired cases found in the system.");
        } else {
            for (String alert : alerts) {
                System.out.println(" - " + alert);
            }
        }
        System.out.println();
    }

    // ---------------------------------------------------------------------------------
    // FULL AUTOMATED DEMO FLOW (ORIGINAL SCRIPTED EXECUTION)
    // ---------------------------------------------------------------------------------

    private static void runAutomatedTestFlow() {
        Citizen citizen = new Citizen("101823948", "Carlos Mendoza", "carlos@gmail.com", "3001234567");

        printHeader("1. REGISTRATION OF PQRS AND CALCULATION OF DEADLINES");

        PQRS complaint = new Complaint("The service experienced intermittent issues over the weekend.", citizen);
        PQRS claim = new Claim("Solicito copia digital de mi contrato de suscripción.", citizen);

        String complaintReference = apiService.RegisterPQRS(complaint);
        String claimReference = apiService.RegisterPQRS(claim);

        System.out.println("Complaint Reference: " + complaintReference + "| State: " + complaint.getState() + "| Limited Date: " + complaint.getLimmitedDate());
        System.out.println("Claim Reference: " + claimReference + "| State: " + claim.getState() + "| Limited Date: " + claim.getLimmitedDate());

        printHeader("2. BUSINESS RULE VALIDATION TEST");

        try {
            System.out.println("Attempting to switch to 'In Progress' without assigning a person in charge...");
            apiService.PassToManagement(claimReference);
        } catch (IllegalStateException e) {
            System.out.println("CORRECTLY CAPTURED: " + e.getMessage());
        }

        printHeader("3. ASSIGNMENT OF RESPONSIBLE AND PROGRESS OF PQRS");

        apiService.AssignResponsible(complaintReference, analyst);
        System.out.println("Responsible assigned: " + complaint.getResponsible().getName() + " (" + complaint.getResponsible().getArea() + ")");
        System.out.println("New State: " + complaint.getState());

        apiService.PassToManagement(complaintReference);
        System.out.println("Updated State to: " + complaint.getState());

        try {
            System.out.println("Attempting to close the case without recording a response...");
            apiService.CloseCase(complaintReference);
        } catch (IllegalStateException e) {
            System.out.println("CORRECTLY CAPTURED: " + e.getMessage());
        }

        printHeader("4. RESPONSE RECORDING AND CLOSURE");

        apiService.answerPQRS(complaintReference, "Preventive maintenance was performed on the sector node. Service restored.", analyst);
        System.out.println("Response recorded by: " + complaint.getAnswer().getAuthor().getName() + " in date: " + complaint.getAnswer().getAnswerDate());
        System.out.println("Case State: " + complaint.getState());

        apiService.CloseCase(complaintReference);
        System.out.println("Case successfully closed. Final Status: " + complaint.getState());

        printHeader("5. MONITORING OF EXPIRED TIMEFRAMES AND ALERTS");

        PQRS expiredComplaint = new Complaint("Incorrect billing for the current period.", citizen);
        expiredComplaint.simulateCreationDateAndLimit(LocalDate.now().minusDays(15), LocalDate.now().minusDays(5));
        apiService.RegisterPQRS(expiredComplaint);
        apiService.AssignResponsible(expiredComplaint.getReference(), analyst);

        List<String> alerts = apiService.generateAlertsSupervisor();
        System.out.println("Alerts generated to: " + supervisor.getName() + " (" + supervisor.getRol() + "):");
        for (String alert : alerts) {
            System.out.println(" - " + alert);
        }

        printHeader("EXECUTION COMPLETED SUCCESSFULLY WITHOUT ERRORS.");
    }

    // Helper method to draw headers with exact ASCII box styling
    private static void printHeader(String title) {
        System.out.println("|---------------------------------------------------------------------------------|");
        System.out.println("|                                                                                 |");
        
        int totalWidth = 81; // Inside space width
        int padding = (totalWidth - title.length()) / 2;
        StringBuilder sb = new StringBuilder("|");
        for (int i = 0; i < padding; i++) sb.append(" ");
        sb.append(title);
        while (sb.length() < 82) sb.append(" ");
        sb.append("|");
        
        System.out.println(sb.toString());
        System.out.println("|                                                                                 |");
        System.out.println("|---------------------------------------------------------------------------------|");
    }
}