package com.example.gymtrack.exercise;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/** Pins the backend muscle hierarchy to {@code MUSCLE_PARENTS} in the frontend. */
class MuscleGroupParentTest {

	private static final Path FRONTEND_MUSCLE_GROUPS = Path.of("frontend", "src", "utils", "muscleGroups.ts");

	private static final Pattern PARENT_ENTRY = Pattern
		.compile("\\{\\s*key:\\s*'([A-Z_]+)'\\s*,\\s*groups:\\s*\\[([^\\]]*)\\]\\s*\\}");

	@Test
	void everyMuscleGroupHasAParent() {
		for (MuscleGroup group : MuscleGroup.values()) {
			assertNotNull(group.parent(), group + " has no parent");
		}
	}

	@Test
	void parentMappingEqualsTheFrontendHierarchy() throws IOException {
		String source = Files.readString(FRONTEND_MUSCLE_GROUPS);
		String block = source.substring(source.indexOf("MUSCLE_PARENTS"));
		Map<String, List<String>> frontend = new LinkedHashMap<>();
		Matcher matcher = PARENT_ENTRY.matcher(block);
		while (matcher.find()) {
			List<String> groups = new ArrayList<>();
			Matcher name = Pattern.compile("'([A-Z_]+)'").matcher(matcher.group(2));
			while (name.find()) {
				groups.add(name.group(1));
			}
			frontend.put(matcher.group(1), groups);
		}
		assertTrue(!frontend.isEmpty(), "no parents parsed from " + FRONTEND_MUSCLE_GROUPS);

		Map<String, List<String>> backend = new LinkedHashMap<>();
		for (MuscleParent parent : MuscleParent.values()) {
			backend.put(parent.name(), Arrays.stream(MuscleGroup.values())
				.filter(group -> group.parent() == parent)
				.map(MuscleGroup::name)
				.toList());
		}
		assertEquals(frontend, backend);
		assertEquals(List.copyOf(frontend.keySet()), List.copyOf(backend.keySet()));
	}

}
