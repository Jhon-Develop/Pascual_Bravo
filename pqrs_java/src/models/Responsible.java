package models;

public class Responsible extends User{
    private String area;
    private boolean isSupervisor;

    public Responsible(String id, String name, String email, String area, boolean isSupervisor) {
        super(id, name, email);
        this.area = area;
        this.isSupervisor = isSupervisor;
    }

    @Override
    public String getRol() { return isSupervisor ? "Area Supervisor" : "Customer Service Analyst";}
    public String getArea() { return area;}
    public boolean isSupervisor() { return isSupervisor;}
}
