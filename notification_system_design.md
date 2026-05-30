# Architectural Evaluation Matrix: Campus Notification Ecosystem

---

## Stage 4: High-Frequency Database Read Optimization

### 1. Architectural Bottleneck Diagnosis
The current approach uses synchronous data fetching directly from the persistent database tier on every single client application page refresh. This creates an O(N) database read overhead relative to user traffic, leading to connection pool starvation, severe I/O degradation, and a sluggish user interface under load.

### 2. Proposed System Design Topologies

#### Strategy A: Memory-Mapped Key-Value Caching Layer (Redis Integration)
* **Execution:** Introduce an in-memory caching cluster ahead of the relational database tier. When an engineering student requests their feed, the application interrogates the fast in-memory cache first.
* **Cache Expiry Model:** Implement a Time-To-Live (TTL) cache invalidation strategy of exactly 5 minutes, alongside selective cache clearing whenever a high-urgency global announcement is broadcasted.
* **Trade-Off Analysis:** 
  * *Pros:* Drastically lowers read latency to sub-millisecond durations; isolates the core transactional database from read-heavy request bottlenecks.
  * *Cons:* Introduces a small window of eventual consistency.

#### Strategy B: Push-Based Application State Management (WebSockets/SSE)
* **Execution:** Move from a pull-based polling architecture to an event-driven push architecture utilizing Server-Sent Events (SSE) or WebSockets managed by a reverse-proxy gateway layer.
* **Trade-Off Analysis:**
  * *Pros:* Completely eliminates read traffic spikes caused by active page reloads, providing instant real-time notification delivery.
  * *Cons:* Requires maintaining open, stateful connections on the server tier, increasing memory and infrastructure overhead under large student concurrency conditions.

---

## Stage 5: Mass Scale Broadcast Engineering & Fault Tolerance

### 1. Structural Shortcomings Analysis of Initial Pseudocode
* **Synchronous Loop Vulnerability:** A single, sequential loop executing blocking HTTP networking operations across 50,000 student records will stall the event execution loop, causing request timeouts.
* **Single Point of Failure (SPOF):** If a network drop occurs at student index #200, the entire remaining execution cascade breaks instantly without state recovery, leaving 49,800 students without alerts.
* **Tight Database Coupling:** Forcing a synchronous database write inline inside the high-velocity notification loop throttles execution throughput to the absolute write limits of the storage disk.

### 2. Highly Resilient Architectural Redesign
To isolate these tasks, the execution loop must be decoupled into an asynchronous, queue-backed architecture using a message broker:

 
