package com.example.gymtrack.plan;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record PlanRequest(

	@NotBlank
	@Size(max = 60)
	String name,

	@NotNull
	@Size(min = 1, max = 50)
	List<@NotNull @Valid PlanEntryRequest> entries

) {
}
