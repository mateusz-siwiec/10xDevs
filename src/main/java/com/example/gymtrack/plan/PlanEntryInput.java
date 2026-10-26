package com.example.gymtrack.plan;

import java.util.UUID;

public record PlanEntryInput(UUID exerciseId, int sets, int reps) {
}
