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

}
