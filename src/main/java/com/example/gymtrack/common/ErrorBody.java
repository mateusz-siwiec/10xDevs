package com.example.gymtrack.common;

import java.util.LinkedHashMap;
import java.util.Map;

/** Builds the error response body: {"error": english text, "code": CODE, [extra entries]}. */
public final class ErrorBody {

	private ErrorBody() {
	}

	public static Map<String, Object> of(ErrorCode code, String message) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("error", message);
		body.put("code", code.name());
		return body;
	}

	public static Map<String, Object> of(ErrorCode code, String message, String field, String rule) {
		Map<String, Object> body = of(code, message);
		if (field != null) {
			body.put("field", field);
		}
		if (rule != null) {
			body.put("rule", rule);
		}
		return body;
	}

	/** Validation failure with optional constraint bounds ({@code min}/{@code max}); null bounds are omitted. */
	public static Map<String, Object> of(ErrorCode code, String message, String field, String rule, Object min,
			Object max) {
		Map<String, Object> body = of(code, message, field, rule);
		if (min != null) {
			body.put("min", min);
		}
		if (max != null) {
			body.put("max", max);
		}
		return body;
	}

}
