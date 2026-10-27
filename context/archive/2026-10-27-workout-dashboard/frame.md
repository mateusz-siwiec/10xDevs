# Frame Brief: Workout dashboard

> Etap ustalania ram przed /10x-plan. Ten dokument rejestruje, co jest *faktycznie*
> przedmiotem problemu, oddzielone od tego, co początkowo założono.

## Zgłoszona obserwacja

Po zalogowaniu użytkownik nie widzi żadnego podsumowania swoich postępów (ile i jak trenował). Dane źródłowe już istnieją.

## Początkowe ujęcie (zachowane)

- **Podana przez użytkownika przyczyna lub podejście**: brakuje ekranu dashboardu z informacjami o treningach, czasie i łącznym wolumenie (powt. × kg).
- **Proponowany przez użytkownika kierunek**: dodać dashboard jako ekran po zalogowaniu.
- **Zawężenie przed delegowaniem**: główny brak to „nie widzę postępów/podsumowania”; metryki pierwszego wycinka: liczba treningów w okresie, czas spędzony na treningu, łączny wolumen (powt. × kg).

## Mapa wymiarów

Obserwacja może pochodzić z każdego z tych wymiarów:

1. **Dane** — czy z obecnego modelu da się wiarygodnie policzyć trzy metryki?
2. **Miejsce wejścia** — `/` to dziś ekran treningu; co ma być „ekranem po zalogowaniu”?  ← część początkowego ujęcia
3. **Zakres produktowy** — dashboard nie jest w PRD ani w roadmapie; czy to nowy slice, czy część istniejącego FR?
4. **Istniejące widoki postępów** — czy FR-010 (wykres per ćwiczenie) już zaspokaja potrzebę?

## Badanie hipotez

| Hipoteza | Dowody | Werdykt |
| --- | --- | --- |
| Dane: brak wystarczających danych | `WorkoutSession` ma `startedAt`/`endedAt` (WorkoutSession.java:25-28); `workout_sets.reps` 1–100 i `weight_kg` > 0, oba not null (V4__create_workout_sessions_and_sets.sql:18-19). Wolumen i liczba sesji liczą się wprost; czas tylko dla zakończonych sesji (`endedAt` nullable, jedna aktywna sesja na użytkownika: WorkoutSessionRepository.java:10) | BRAK (dane wystarczają) |
| Miejsce wejścia | `/` renderuje `WorkoutPage` (App.tsx:17-23), która jest jednocześnie ekranem startu/prowadzenia sesji (WorkoutPage.tsx:81-175). Dashboard „po zalogowaniu” wymaga decyzji: nowa trasa vs. przeniesienie startu treningu | SILNE (realny punkt decyzyjny) |
| Zakres produktowy | Brak FR w PRD (prd.md:73-151); roadmapa M-1 ma `Done when: every F/S done` i nie zawiera dashboardu (roadmap.md:16-26, tabela). Pokrewne: FR-014 (PR), FR-016 (balans wolumenu) jako osobne slice'y | SILNE (nowy, niezaplanowany slice) |
| FR-010 już wystarcza | Jedyny istniejący agregat to max waga per ćwiczenie (WorkoutSetRepository.java:17-24); brak agregatów per użytkownik/okres | SŁABE (nie pokrywa tej potrzeby) |

## Sygnały zawężające

- Użytkownik wskazał brak podsumowania postępów (nie brak szybkiego startu ani motywacji) i wybrał wszystkie trzy metryki.
- Każdy zapis serii ma dodatnią wagę (constraint DB), więc obawa o ćwiczenia z ciężarem 0 nie dotyczy obecnego modelu.

## Konwencja między systemami

Typowy wzorzec: jeden endpoint agregujący po stronie serwera (SUM/COUNT po okresie), SPA tylko renderuje. Pasuje do architektury projektu (REST `/api/**`, brak templatingu).

## Przeformułowany (lub potwierdzony) opis problemu

> **Rzeczywisty problem, wokół którego należy planować, to**: użytkownik nie ma widoku zagregowanych postępów (liczba treningów, czas, wolumen w okresie), a decyzja o miejscu tego widoku względem obecnego `/` jest otwarta.

Początkowe ujęcie było prawidłowe — kontynuuj w pierwotnie proponowanym kierunku. Dwa doprecyzowania: (1) to nowy slice spoza PRD/roadmapy, więc wymaga wpisu w roadmapie (lub świadomej decyzji, że jest poza M-1); (2) „ekran po zalogowaniu” nie jest oczywisty, bo `/` to dziś ekran treningu.

## Pewność

**WYSOKA** — dane i brak pokrycia w istniejących widokach są zweryfikowane w kodzie; otwarte pozostaje tylko decyzja produktowa (miejsce wejścia, okres), którą rozstrzyga /10x-plan.

## Co zmienia się dla /10x-plan

Planować agregaty (liczba sesji, czas zakończonych sesji, Σ reps × weight_kg) dla okresu oraz ich widok; w planie rozstrzygnąć trasę (dashboard na `/` vs. osobna) i traktowanie niezakończonej sesji w czasie. Pierwotne ujęcie się potwierdziło.

## Odniesienia

- Pliki źródłowe: WorkoutSession.java:25-28, V4__create_workout_sessions_and_sets.sql:18-19, WorkoutSessionRepository.java:10, WorkoutSetRepository.java:17-24, App.tsx:17-23, WorkoutPage.tsx:81-175, roadmap.md:16-26, prd.md:73-151
- Zadania badawcze: brak (system mały, zbadany bezpośrednio, bez pod-agentów)
