package models;

public class Citizen extends User {
    private String phone;

    public Citizen(String id, String name, String email, String phone) {
        super(id, name, email);
        this.phone = phone;
    }

    @Override 
    public String getRol() { return "CITIZEN";}
    public String getPhone() { return phone;}
    public void setPhone(String phone) { this.phone = phone;}
}
