package models;

public abstract class User {
    protected String id;
    protected String name;
    protected String email;

    public User(String id, String name, String email) {
        if (id == null || id.trim().isEmpty()){
            throw new IllegalArgumentException("User id cannot be null or empty");
        }
        if (name == null || name.trim().isEmpty()){
            throw new IllegalArgumentException("User name cannot be null or empty");
        }
        this.id = id;
        this.name = name;
        this.email = email;
    }

    public abstract String getRol();

    public String getId() { return id;}
    public String getName() { return name;}
    public String getEmail() { return email;}

    public void setName(String name) { this.name = name;}
    public void setEmail(String email) { this.email = email;}
}
