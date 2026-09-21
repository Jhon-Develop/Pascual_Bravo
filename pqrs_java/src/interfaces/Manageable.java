package interfaces;

import models.Responsible;
import models.Answer;

public interface Manageable {
    public void assignResponsible(Responsible responsible);
    public void putIntoManagement();
    public void recordResponse(Answer answer);
    public void closeCase();
}