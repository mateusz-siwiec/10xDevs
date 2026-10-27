package com.example.gymtrack.workout;

import java.util.List;

public record HistoryPageResponse(List<HistoryItemResponse> items, int page, int size, long totalElements,
		int totalPages) {
}
