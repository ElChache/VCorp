# MonitorHub - System Architecture Document

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MonitorHub System                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   Web Portal    │    │  SvelteKit App  │    │   Admin UI   │ │
│  │  (Marketing)    │    │   (Dashboard)   │    │  (Future)    │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                     Load Balancer / CDN                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    API Gateway                              │ │
│  │         ┌─────────────┐  ┌─────────────┐                   │ │
│  │         │ Auth Service │  │ Rate Limiter│                   │ │
│  │         └─────────────┘  └─────────────┘                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Monitor API    │  │   User API      │  │  Actions API    │ │
│  │   Service       │  │   Service       │  │   Service       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  AI Processing  │  │  Queue Manager  │  │  Email Service  │ │
│  │   Service       │  │   (BullMQ)      │  │   (AWS SES)     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   PostgreSQL    │  │      Redis      │  │   File Storage  │ │
│  │   (Primary DB)  │  │  (Cache/Queue)  │  │   (Charts/Logs) │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Component Relationships

The MonitorHub system follows a layered architecture with clear separation of concerns:

1. **Presentation Layer**: SvelteKit frontend with TypeScript
2. **API Layer**: Node.js/Express REST API with authentication middleware
3. **Business Logic Layer**: Domain services for monitors, facts, and evaluations
4. **AI Integration Layer**: Provider abstraction with Claude/OpenAI failover
5. **Data Layer**: PostgreSQL for persistence, Redis for caching and queues

### Technology Stack Justifications

| Component | Technology | Justification |
|-----------|------------|---------------|
| Frontend | SvelteKit + TypeScript | Modern, performant, excellent SSR/SSG, smaller bundle size |
| Backend API | Node.js + Express + TypeScript | JavaScript ecosystem consistency, rich library support |
| Database | PostgreSQL | ACID compliance, JSON support, partitioning, mature ecosystem |
| Cache/Queue | Redis + BullMQ | High performance, persistent queues, pub/sub capabilities |
| Email | AWS SES | Cost-effective, reliable delivery, programmatic API |
| AI Providers | Claude + OpenAI | Best-in-class natural language understanding and generation |
| Deployment | Vercel | Automatic deployments, edge network, serverless scaling |

### Data Flow Diagram

```
User Input → AI Processing → Monitor Storage → Background Evaluation → Email Notifications

┌─────────┐   ┌──────────┐   ┌─────────────┐   ┌──────────────┐   ┌─────────┐
│  User   │──→│    AI    │──→│   Database  │──→│  Queue Jobs  │──→│ Email   │
│ Creates │   │Interprets│   │   Stores    │   │  Evaluate    │   │Delivery │
│Monitor  │   │ Prompt   │   │  Monitor    │   │  Monitors    │   │Service  │
└─────────┘   └──────────┘   └─────────────┘   └──────────────┘   └─────────┘
      │           │                 │               │                   │
      │           │                 │               ▼                   │
      │           │                 │      ┌──────────────────┐         │
      │           │                 │      │ Extract Current  │         │
      │           │                 │      │ Facts & Compare  │         │
      │           │                 │      │ to History       │         │
      │           │                 │      └──────────────────┘         │
      │           │                 │               │                   │
      │           │                 │               ▼                   │
      │           │                 │      ┌──────────────────┐         │
      │           │                 │      │ Trigger Actions  │         │
      │           │                 │      │ if Conditions    │         │
      │           │                 │      │ are Met          │         │
      │           │                 │      └──────────────────┘         │
      │           │                 │               │                   │
      └───────────┴─────────────────┴───────────────┴───────────────────┘
                            Feedback Loop: User sees results
```

## Database Design

### PostgreSQL Schema DDL

```sql
-- Core user management
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- NULL for OAuth-only users
    display_name VARCHAR(100),
    email_verified BOOLEAN DEFAULT FALSE,
    oauth_provider VARCHAR(50), -- 'google', NULL for email/password
    oauth_id VARCHAR(255), -- External OAuth ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    beta_whitelist BOOLEAN DEFAULT FALSE,
    preferences JSONB DEFAULT '{}' -- User settings like timezone, theme
);

-- Monitor definitions created by users
CREATE TABLE monitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, -- AI-generated from prompt
    description TEXT, -- Original user prompt
    
    -- AI interpretation results
    monitor_type VARCHAR(50) NOT NULL, -- 'current_state', 'change_detection'
    fact_to_extract TEXT NOT NULL, -- What the AI should look for
    trigger_conditions JSONB NOT NULL, -- Conditions that activate monitor
    evaluation_frequency INTEGER NOT NULL DEFAULT 3600, -- seconds between checks
    
    -- Monitor configuration
    is_active BOOLEAN DEFAULT TRUE,
    next_evaluation_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_evaluation_at TIMESTAMP WITH TIME ZONE,
    
    -- Scheduling
    active_hours JSONB, -- When monitor should run, e.g., {"start": "09:00", "end": "17:00", "timezone": "UTC"}
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_monitor_type CHECK (monitor_type IN ('current_state', 'change_detection'))
);

-- Facts extracted from AI evaluation (current state snapshots)
CREATE TABLE monitor_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    extracted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Fact data
    fact_value JSONB NOT NULL, -- The actual extracted fact value
    fact_type VARCHAR(50) NOT NULL, -- 'numeric', 'boolean', 'text', 'json'
    raw_ai_response TEXT, -- Full AI response for debugging
    processing_time_ms INTEGER, -- Performance tracking
    ai_provider VARCHAR(50) NOT NULL, -- 'claude', 'openai'
    
    -- Quality metrics
    confidence_score DECIMAL(3,2), -- AI confidence if available
    extraction_success BOOLEAN DEFAULT TRUE,
    error_message TEXT -- If extraction failed
);

-- Temporal history of all fact values (partitioned for performance)
CREATE TABLE fact_history (
    id UUID DEFAULT gen_random_uuid(),
    monitor_id UUID NOT NULL,
    fact_id UUID NOT NULL REFERENCES monitor_facts(id),
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Historical data
    previous_value JSONB, -- Previous fact value for change detection
    current_value JSONB NOT NULL, -- Current fact value
    change_detected BOOLEAN DEFAULT FALSE,
    change_magnitude DECIMAL, -- Numeric change amount when applicable
    change_percentage DECIMAL, -- Percentage change when applicable
    
    PRIMARY KEY (recorded_at, monitor_id)
) PARTITION BY RANGE (recorded_at);

-- Partition tables for fact history (3 months each)
CREATE TABLE fact_history_2025_q1 PARTITION OF fact_history
    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
CREATE TABLE fact_history_2025_q2 PARTITION OF fact_history
    FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
CREATE TABLE fact_history_2025_q3 PARTITION OF fact_history
    FOR VALUES FROM ('2025-07-01') TO ('2025-10-01');
CREATE TABLE fact_history_2025_q4 PARTITION OF fact_history
    FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');

-- Monitor evaluation results and trigger events
CREATE TABLE monitor_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Evaluation outcome
    trigger_activated BOOLEAN DEFAULT FALSE,
    trigger_reason TEXT, -- Human-readable explanation
    conditions_met JSONB, -- Which specific conditions were satisfied
    
    -- Performance and reliability
    evaluation_duration_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Related data
    fact_id UUID REFERENCES monitor_facts(id),
    previous_fact_id UUID REFERENCES monitor_facts(id) -- For change detection
);

-- Monitor trigger history for user notifications and debugging
CREATE TABLE monitor_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    evaluation_id UUID NOT NULL REFERENCES monitor_evaluations(id),
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Trigger context
    trigger_type VARCHAR(50) NOT NULL, -- 'state_change', 'threshold_crossed', 'condition_met'
    trigger_data JSONB NOT NULL, -- Context data for the trigger
    
    -- User notification tracking
    actions_executed INTEGER DEFAULT 0,
    notifications_sent INTEGER DEFAULT 0,
    
    CONSTRAINT valid_trigger_type CHECK (trigger_type IN (
        'state_change', 'threshold_crossed', 'condition_met', 'manual_test'
    ))
);

-- Email notifications sent to users
CREATE TABLE email_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    monitor_id UUID REFERENCES monitors(id) ON DELETE SET NULL, -- Can be NULL for system emails
    trigger_id UUID REFERENCES monitor_triggers(id) ON DELETE SET NULL,
    
    -- Email details
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT NOT NULL,
    
    -- Sending metadata
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    email_provider VARCHAR(50) NOT NULL DEFAULT 'aws_ses', -- 'aws_ses', 'sendgrid'
    provider_message_id VARCHAR(255), -- Provider's tracking ID
    
    -- Delivery tracking
    delivery_status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'
    delivery_timestamp TIMESTAMP WITH TIME ZONE,
    bounce_reason TEXT,
    opens_count INTEGER DEFAULT 0,
    clicks_count INTEGER DEFAULT 0,
    
    -- Email content type
    notification_type VARCHAR(50) NOT NULL DEFAULT 'monitor_trigger', -- 'monitor_trigger', 'welcome', 'system'
    
    CONSTRAINT valid_delivery_status CHECK (delivery_status IN (
        'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'
    ))
);

-- Performance optimization indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_id) WHERE oauth_provider IS NOT NULL;
CREATE INDEX idx_users_beta ON users(beta_whitelist) WHERE beta_whitelist = TRUE;

CREATE INDEX idx_monitors_user_id ON monitors(user_id);
CREATE INDEX idx_monitors_active ON monitors(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_monitors_next_evaluation ON monitors(next_evaluation_at) WHERE is_active = TRUE;
CREATE INDEX idx_monitors_type ON monitors(monitor_type);

CREATE INDEX idx_monitor_facts_monitor_id ON monitor_facts(monitor_id);
CREATE INDEX idx_monitor_facts_extracted_at ON monitor_facts(extracted_at DESC);
CREATE INDEX idx_monitor_facts_provider ON monitor_facts(ai_provider);

-- Fact history indexes on each partition
CREATE INDEX idx_fact_history_monitor_recorded ON fact_history(monitor_id, recorded_at DESC);
CREATE INDEX idx_fact_history_change_detected ON fact_history(change_detected) WHERE change_detected = TRUE;

CREATE INDEX idx_monitor_evaluations_monitor_id ON monitor_evaluations(monitor_id);
CREATE INDEX idx_monitor_evaluations_triggered ON monitor_evaluations(trigger_activated) WHERE trigger_activated = TRUE;
CREATE INDEX idx_monitor_evaluations_evaluated_at ON monitor_evaluations(evaluated_at DESC);

CREATE INDEX idx_monitor_triggers_monitor_id ON monitor_triggers(monitor_id);
CREATE INDEX idx_monitor_triggers_triggered_at ON monitor_triggers(triggered_at DESC);

CREATE INDEX idx_email_notifications_user_id ON email_notifications(user_id);
CREATE INDEX idx_email_notifications_monitor_id ON email_notifications(monitor_id) WHERE monitor_id IS NOT NULL;
CREATE INDEX idx_email_notifications_sent_at ON email_notifications(sent_at DESC);
CREATE INDEX idx_email_notifications_delivery_status ON email_notifications(delivery_status);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monitors_updated_at BEFORE UPDATE ON monitors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Partitioning Strategy for fact_history

The `fact_history` table will grow rapidly and requires partitioning for optimal performance:

1. **Range Partitioning by recorded_at**: 3-month partitions
2. **Automated Partition Management**: Cron job to create future partitions
3. **Archival Strategy**: Move partitions older than 2 years to cold storage
4. **Maintenance Windows**: Quarterly partition maintenance during low usage

## API Architecture

### RESTful Endpoint Organization

```typescript
// Base API structure
/api/v1/
├── auth/           # Authentication endpoints
├── users/          # User management
├── monitors/       # Monitor CRUD and management
├── facts/          # Historical data access
├── evaluations/    # Monitor evaluation results
├── notifications/  # Email notification management
└── system/         # Health checks and status
```

### TypeScript Interfaces

```typescript
// Domain Entities
export interface User {
  id: string;
  email: string;
  displayName?: string;
  emailVerified: boolean;
  oauthProvider?: 'google';
  createdAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
  betaWhitelist: boolean;
  preferences: UserPreferences;
}

export interface UserPreferences {
  timezone?: string;
  theme?: 'light' | 'dark';
  emailFrequencyLimit?: number; // max emails per hour
  quietHours?: {
    start: string; // "22:00"
    end: string;   // "08:00"
    timezone: string;
  };
}

export interface Monitor {
  id: string;
  userId: string;
  name: string;
  description: string; // Original prompt
  
  // AI interpretation
  monitorType: 'current_state' | 'change_detection';
  factToExtract: string;
  triggerConditions: TriggerConditions;
  evaluationFrequency: number; // seconds
  
  // Configuration
  isActive: boolean;
  nextEvaluationAt: Date;
  lastEvaluationAt?: Date;
  activeHours?: ScheduleWindow;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface TriggerConditions {
  type: 'threshold' | 'equality' | 'change' | 'complex';
  conditions: Array<{
    field: string;
    operator: 'gt' | 'lt' | 'eq' | 'ne' | 'contains' | 'change_gt' | 'change_lt';
    value: any;
    unit?: string;
  }>;
  logic?: 'AND' | 'OR'; // For multiple conditions
}

export interface ScheduleWindow {
  start: string; // "09:00"
  end: string;   // "17:00"
  timezone: string;
  daysOfWeek?: number[]; // 0-6, Sunday=0
}

export interface MonitorFact {
  id: string;
  monitorId: string;
  extractedAt: Date;
  factValue: any;
  factType: 'numeric' | 'boolean' | 'text' | 'json';
  rawAiResponse: string;
  processingTimeMs: number;
  aiProvider: 'claude' | 'openai';
  confidenceScore?: number;
  extractionSuccess: boolean;
  errorMessage?: string;
}

export interface FactHistory {
  id: string;
  monitorId: string;
  factId: string;
  recordedAt: Date;
  previousValue?: any;
  currentValue: any;
  changeDetected: boolean;
  changeMagnitude?: number;
  changePercentage?: number;
}

export interface MonitorEvaluation {
  id: string;
  monitorId: string;
  evaluatedAt: Date;
  triggerActivated: boolean;
  triggerReason?: string;
  conditionsMet: Record<string, boolean>;
  evaluationDurationMs: number;
  success: boolean;
  errorMessage?: string;
  retryCount: number;
  factId?: string;
  previousFactId?: string;
}

export interface EmailNotification {
  id: string;
  userId: string;
  monitorId?: string;
  triggerId?: string;
  recipientEmail: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  sentAt: Date;
  emailProvider: 'aws_ses' | 'sendgrid';
  providerMessageId?: string;
  deliveryStatus: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  deliveryTimestamp?: Date;
  bounceReason?: string;
  opensCount: number;
  clicksCount: number;
  notificationType: 'monitor_trigger' | 'welcome' | 'system';
}
```

### Authentication/Authorization Model

```typescript
// JWT payload structure
export interface JWTPayload {
  sub: string; // user ID
  email: string;
  iat: number; // issued at
  exp: number; // expires at
  type: 'access' | 'refresh';
}

// Authentication middleware
export interface AuthMiddleware {
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
  requireBetaAccess: (req: Request, res: Response, next: NextFunction) => void;
  optionalAuth: (req: Request, res: Response, next: NextFunction) => void;
}

// Authorization model
export interface AuthContext {
  user?: User;
  isAuthenticated: boolean;
  isBetaUser: boolean;
  canAccess: (resource: string, action: string) => boolean;
}
```

### Rate Limiting Strategy

```typescript
// Rate limiting configuration
export const RATE_LIMITS = {
  // Authentication endpoints
  LOGIN: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 attempts per 15 minutes
  REGISTER: { windowMs: 60 * 60 * 1000, max: 3 }, // 3 registrations per hour
  PASSWORD_RESET: { windowMs: 60 * 60 * 1000, max: 3 },
  
  // API endpoints by user level
  BETA_USER_API: { windowMs: 60 * 1000, max: 100 }, // 100 requests per minute
  AUTHENTICATED: { windowMs: 60 * 1000, max: 60 },   // 60 requests per minute
  ANONYMOUS: { windowMs: 60 * 1000, max: 10 },       // 10 requests per minute
  
  // Specific endpoint limits
  MONITOR_CREATE: { windowMs: 60 * 1000, max: 10 },  // 10 monitors per minute
  AI_PROCESSING: { windowMs: 60 * 1000, max: 30 },   // 30 AI calls per minute
  EMAIL_SEND: { windowMs: 60 * 1000, max: 20 },      // 20 emails per minute
} as const;
```

### Error Handling Patterns

```typescript
// Standardized error response format
export interface APIError {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
  };
}

// Error codes and HTTP status mapping
export const ERROR_CODES = {
  // Authentication (4xx)
  UNAUTHORIZED: { status: 401, code: 'UNAUTHORIZED' },
  FORBIDDEN: { status: 403, code: 'FORBIDDEN' },
  NOT_FOUND: { status: 404, code: 'NOT_FOUND' },
  VALIDATION_ERROR: { status: 400, code: 'VALIDATION_ERROR' },
  RATE_LIMITED: { status: 429, code: 'RATE_LIMITED' },
  
  // Business Logic (4xx)
  MONITOR_LIMIT_EXCEEDED: { status: 400, code: 'MONITOR_LIMIT_EXCEEDED' },
  INVALID_MONITOR_PROMPT: { status: 400, code: 'INVALID_MONITOR_PROMPT' },
  AI_PROCESSING_FAILED: { status: 422, code: 'AI_PROCESSING_FAILED' },
  
  // System Errors (5xx)
  INTERNAL_ERROR: { status: 500, code: 'INTERNAL_ERROR' },
  DATABASE_ERROR: { status: 503, code: 'DATABASE_ERROR' },
  AI_SERVICE_UNAVAILABLE: { status: 503, code: 'AI_SERVICE_UNAVAILABLE' },
  EMAIL_SERVICE_UNAVAILABLE: { status: 503, code: 'EMAIL_SERVICE_UNAVAILABLE' },
} as const;
```

## AI Integration Design

### Provider Abstraction Interface

```typescript
// Core AI provider interface
export interface IMonitorAI {
  // Main AI operations
  interpretPrompt(prompt: string): Promise<MonitorInterpretation>;
  extractFact(monitor: Monitor, context?: string): Promise<FactExtraction>;
  evaluateConditions(
    monitor: Monitor, 
    currentFact: any, 
    previousFact?: any
  ): Promise<ConditionEvaluation>;
  
  // Provider management
  getProviderInfo(): AIProviderInfo;
  isHealthy(): Promise<boolean>;
  estimateCost(operation: AIOperation): number;
}

export interface MonitorInterpretation {
  monitorType: 'current_state' | 'change_detection';
  factToExtract: string;
  triggerConditions: TriggerConditions;
  evaluationFrequency: number;
  confidence: number; // 0-1
  reasoning: string; // AI explanation
  suggestedName: string;
}

export interface FactExtraction {
  factValue: any;
  factType: 'numeric' | 'boolean' | 'text' | 'json';
  confidence: number;
  processingTimeMs: number;
  rawResponse: string;
  success: boolean;
  errorMessage?: string;
}

export interface ConditionEvaluation {
  triggerActivated: boolean;
  conditionsMet: Record<string, boolean>;
  reasoning: string;
  confidence: number;
}

export interface AIProviderInfo {
  name: 'claude' | 'openai';
  model: string;
  version: string;
  maxTokens: number;
  costPerToken: number;
}

// Implementation for Claude
export class ClaudeAIProvider implements IMonitorAI {
  private client: Anthropic;
  private model = 'claude-3-sonnet-20240229';
  
  constructor(private apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }
  
  async interpretPrompt(prompt: string): Promise<MonitorInterpretation> {
    const systemPrompt = `
You are an expert at interpreting natural language monitoring requests.
Analyze the user's prompt and determine:
1. Monitor type (current_state or change_detection)  
2. What specific fact to extract
3. What conditions should trigger alerts
4. How frequently to check
5. A good name for this monitor

Return valid JSON matching the MonitorInterpretation interface.
    `;
    
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }]
    });
    
    // Parse and validate response
    return this.parseInterpretation(message.content);
  }
  
  // ... other methods
}

// Implementation for OpenAI (fallback)
export class OpenAIProvider implements IMonitorAI {
  private client: OpenAI;
  
  constructor(private apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }
  
  // Similar implementation with OpenAI API
}
```

### Prompt Classification Service

```typescript
export class PromptClassificationService {
  constructor(private aiProvider: IMonitorAI) {}
  
  async classifyPrompt(prompt: string): Promise<PromptClassification> {
    // Validate prompt length and content
    this.validatePrompt(prompt);
    
    // Get AI interpretation
    const interpretation = await this.aiProvider.interpretPrompt(prompt);
    
    // Post-process and enhance
    return {
      ...interpretation,
      category: this.categorizeMonitor(interpretation),
      complexity: this.assessComplexity(interpretation),
      estimatedCost: this.estimateRunningCost(interpretation),
      warnings: this.identifyWarnings(interpretation)
    };
  }
  
  private validatePrompt(prompt: string): void {
    if (!prompt || prompt.trim().length === 0) {
      throw new ValidationError('Prompt cannot be empty');
    }
    
    if (prompt.length > 500) {
      throw new ValidationError('Prompt exceeds maximum length of 500 characters');
    }
    
    // Check for potentially problematic patterns
    const problematicPatterns = [
      /password|secret|token|key/i,
      /delete|destroy|remove|hack/i,
      /personal.*information|ssn|credit.*card/i
    ];
    
    for (const pattern of problematicPatterns) {
      if (pattern.test(prompt)) {
        throw new ValidationError('Prompt contains potentially sensitive or harmful content');
      }
    }
  }
  
  private categorizeMonitor(interpretation: MonitorInterpretation): MonitorCategory {
    const categories: Record<string, RegExp[]> = {
      FINANCIAL: [/stock|price|market|crypto|currency|trading/i],
      WEATHER: [/weather|temperature|rain|snow|wind|climate/i],
      SPORTS: [/game|score|team|player|match|tournament/i],
      NEWS: [/news|article|headline|breaking|announcement/i],
      TECHNOLOGY: [/server|api|website|status|uptime|performance/i],
      OTHER: [/.*/] // Default fallback
    };
    
    for (const [category, patterns] of Object.entries(categories)) {
      for (const pattern of patterns) {
        if (pattern.test(interpretation.factToExtract)) {
          return category as MonitorCategory;
        }
      }
    }
    
    return 'OTHER';
  }
}

export interface PromptClassification extends MonitorInterpretation {
  category: MonitorCategory;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedCost: number; // USD per month
  warnings: string[];
}

export type MonitorCategory = 
  | 'FINANCIAL' 
  | 'WEATHER' 
  | 'SPORTS' 
  | 'NEWS' 
  | 'TECHNOLOGY' 
  | 'OTHER';
```

### Fact Extraction Pipeline

```typescript
export class FactExtractionPipeline {
  constructor(
    private aiProvider: IMonitorAI,
    private fallbackProvider: IMonitorAI,
    private cacheService: CacheService
  ) {}
  
  async extractFact(monitor: Monitor): Promise<FactExtraction> {
    const cacheKey = `fact:${monitor.id}:${Date.now()}`;
    
    try {
      // Try primary AI provider
      const result = await this.extractWithProvider(monitor, this.aiProvider);
      
      // Cache successful results
      if (result.success) {
        await this.cacheService.set(cacheKey, result, 300); // 5 min cache
      }
      
      return result;
      
    } catch (error) {
      console.warn('Primary AI provider failed, trying fallback:', error);
      
      // Try fallback provider
      try {
        return await this.extractWithProvider(monitor, this.fallbackProvider);
      } catch (fallbackError) {
        console.error('Both AI providers failed:', fallbackError);
        
        // Return failure state
        return {
          factValue: null,
          factType: 'text',
          confidence: 0,
          processingTimeMs: 0,
          rawResponse: '',
          success: false,
          errorMessage: `AI extraction failed: ${fallbackError.message}`
        };
      }
    }
  }
  
  private async extractWithProvider(
    monitor: Monitor, 
    provider: IMonitorAI
  ): Promise<FactExtraction> {
    const startTime = Date.now();
    
    // Build context for AI extraction
    const context = await this.buildExtractionContext(monitor);
    
    // Perform extraction
    const result = await provider.extractFact(monitor, context);
    result.processingTimeMs = Date.now() - startTime;
    
    // Validate extraction result
    await this.validateExtraction(monitor, result);
    
    return result;
  }
  
  private async buildExtractionContext(monitor: Monitor): Promise<string> {
    // Get recent history for context
    const recentHistory = await this.getRecentHistory(monitor.id, 5);
    
    const context = {
      monitorType: monitor.monitorType,
      factToExtract: monitor.factToExtract,
      recentValues: recentHistory.map(h => ({
        timestamp: h.recordedAt,
        value: h.currentValue
      })),
      currentTime: new Date().toISOString()
    };
    
    return JSON.stringify(context);
  }
}
```

### Failover Mechanisms

```typescript
export class AIProviderManager {
  private providers: Map<string, IMonitorAI> = new Map();
  private healthStatus: Map<string, boolean> = new Map();
  private failoverRules: FailoverRule[] = [];
  
  constructor(
    private primaryProvider: IMonitorAI,
    private fallbackProvider: IMonitorAI,
    private metricsService: MetricsService
  ) {
    this.providers.set('primary', primaryProvider);
    this.providers.set('fallback', fallbackProvider);
    
    // Health check every 5 minutes
    setInterval(() => this.checkProviderHealth(), 5 * 60 * 1000);
  }
  
  async getProvider(operation: AIOperation): Promise<IMonitorAI> {
    const primaryHealthy = this.healthStatus.get('primary') ?? true;
    
    // Check if primary provider should be used
    if (primaryHealthy && !this.shouldFailover(operation)) {
      return this.primaryProvider;
    }
    
    // Use fallback provider
    this.metricsService.incrementCounter('ai.failover', {
      operation: operation.type,
      reason: primaryHealthy ? 'rule_triggered' : 'health_check_failed'
    });
    
    return this.fallbackProvider;
  }
  
  private async checkProviderHealth(): Promise<void> {
    for (const [name, provider] of this.providers) {
      try {
        const healthy = await provider.isHealthy();
        this.healthStatus.set(name, healthy);
        
        this.metricsService.recordGauge(`ai.provider.health.${name}`, healthy ? 1 : 0);
        
      } catch (error) {
        console.error(`Health check failed for provider ${name}:`, error);
        this.healthStatus.set(name, false);
      }
    }
  }
  
  private shouldFailover(operation: AIOperation): boolean {
    // Check cost-based failover rules
    const primaryCost = this.primaryProvider.estimateCost(operation);
    const fallbackCost = this.fallbackProvider.estimateCost(operation);
    
    if (primaryCost > fallbackCost * 2) {
      return true; // Failover if primary is 2x more expensive
    }
    
    // Check rate limiting
    const primaryRate = this.metricsService.getRate('ai.primary.requests');
    if (primaryRate > 100) { // requests per minute
      return true;
    }
    
    // Check error rate
    const primaryErrorRate = this.metricsService.getRate('ai.primary.errors');
    if (primaryErrorRate > 0.1) { // 10% error rate
      return true;
    }
    
    return false;
  }
}

interface FailoverRule {
  condition: 'cost' | 'rate_limit' | 'error_rate' | 'latency';
  threshold: number;
  action: 'failover' | 'throttle' | 'alert';
}
```

### Cost Optimization Strategies

```typescript
export class AICostOptimizer {
  private costTracker: Map<string, number> = new Map();
  private dailyBudget = 100; // USD per day
  
  constructor(private metricsService: MetricsService) {}
  
  async optimizeRequest(operation: AIOperation): Promise<OptimizedRequest> {
    // Check daily budget
    const todayCost = this.getTodayCost();
    if (todayCost > this.dailyBudget * 0.9) {
      throw new Error('Approaching daily AI budget limit');
    }
    
    // Cache optimization
    const cached = await this.checkCache(operation);
    if (cached) {
      return { ...operation, useCached: true, estimatedCost: 0 };
    }
    
    // Batch optimization for similar operations
    const batch = await this.findBatchOpportunity(operation);
    if (batch) {
      return { ...operation, batchWith: batch, estimatedCost: operation.estimatedCost * 0.7 };
    }
    
    // Provider optimization
    const cheaperProvider = await this.findCheaperProvider(operation);
    if (cheaperProvider) {
      return { ...operation, preferredProvider: cheaperProvider };
    }
    
    return operation;
  }
  
  private getTodayCost(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.costTracker.get(today) ?? 0;
  }
  
  async trackCost(operation: AIOperation, actualCost: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const currentCost = this.costTracker.get(today) ?? 0;
    this.costTracker.set(today, currentCost + actualCost);
    
    // Metrics
    this.metricsService.recordGauge('ai.cost.daily', currentCost + actualCost);
    this.metricsService.incrementCounter('ai.cost.total', actualCost);
    
    // Budget alerts
    const percentUsed = (currentCost + actualCost) / this.dailyBudget;
    if (percentUsed > 0.8) {
      await this.sendBudgetAlert(percentUsed);
    }
  }
}
```

## Queue and Background Processing

### BullMQ Job Definitions

```typescript
// Job type definitions
export interface MonitorEvaluationJob {
  monitorId: string;
  userId: string;
  retryCount?: number;
  priority?: number;
}

export interface EmailNotificationJob {
  notificationId: string;
  userId: string;
  monitorId?: string;
  triggerId?: string;
  priority: 'high' | 'normal' | 'low';
}

export interface FactExtractionJob {
  monitorId: string;
  scheduledAt: Date;
  previousFactId?: string;
}

// Job queue definitions
export class QueueManager {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  
  constructor(private redisConnection: IORedis.Redis) {
    this.initializeQueues();
    this.initializeWorkers();
  }
  
  private initializeQueues(): void {
    // Monitor evaluation queue
    const evaluationQueue = new Queue('monitor-evaluation', {
      connection: this.redisConnection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });
    this.queues.set('monitor-evaluation', evaluationQueue);
    
    // Email notification queue
    const emailQueue = new Queue('email-notification', {
      connection: this.redisConnection,
      defaultJobOptions: {
        removeOnComplete: 500,
        removeOnFail: 100,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });
    this.queues.set('email-notification', emailQueue);
    
    // Fact extraction queue
    const factQueue = new Queue('fact-extraction', {
      connection: this.redisConnection,
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 50,
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 5000,
        },
      },
    });
    this.queues.set('fact-extraction', factQueue);
  }
  
  private initializeWorkers(): void {
    // Monitor evaluation worker
    const evaluationWorker = new Worker(
      'monitor-evaluation',
      new URL('./workers/monitor-evaluation.js', import.meta.url),
      {
        connection: this.redisConnection,
        concurrency: 10, // Process 10 monitors simultaneously
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );
    this.workers.set('monitor-evaluation', evaluationWorker);
    
    // Email notification worker  
    const emailWorker = new Worker(
      'email-notification',
      new URL('./workers/email-notification.js', import.meta.url),
      {
        connection: this.redisConnection,
        concurrency: 5, // Rate limited by email service
        removeOnComplete: 500,
        removeOnFail: 100,
      }
    );
    this.workers.set('email-notification', emailWorker);
  }
}
```

### Monitor Evaluation Scheduling

```typescript
export class MonitorScheduler {
  private scheduler: Scheduler;
  
  constructor(
    private queueManager: QueueManager,
    private monitorRepository: MonitorRepository
  ) {
    this.scheduler = new Scheduler(
      'monitor-scheduler',
      {
        connection: queueManager.redisConnection,
        maxStalledCount: 1,
        stalledInterval: 30 * 1000, // 30 seconds
        retryProcessDelay: 5000,
      }
    );
  }
  
  async scheduleMonitor(monitor: Monitor): Promise<void> {
    // Calculate next evaluation time
    const nextEvaluationAt = this.calculateNextEvaluation(monitor);
    
    // Schedule the job
    await this.scheduler.add(
      'monitor-evaluation',
      {
        monitorId: monitor.id,
        userId: monitor.userId,
      },
      {
        delay: nextEvaluationAt.getTime() - Date.now(),
        jobId: `eval-${monitor.id}-${nextEvaluationAt.getTime()}`, // Unique ID prevents duplicates
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    
    // Update monitor's next evaluation time
    await this.monitorRepository.updateNextEvaluation(monitor.id, nextEvaluationAt);
  }
  
  async rescheduleMonitor(monitorId: string): Promise<void> {
    // Remove existing scheduled job
    await this.scheduler.getJobs(['delayed']).then(jobs => {
      const existingJob = jobs.find(job => job.data.monitorId === monitorId);
      if (existingJob) {
        existingJob.remove();
      }
    });
    
    // Get updated monitor and reschedule
    const monitor = await this.monitorRepository.findById(monitorId);
    if (monitor && monitor.isActive) {
      await this.scheduleMonitor(monitor);
    }
  }
  
  private calculateNextEvaluation(monitor: Monitor): Date {
    const now = new Date();
    const frequency = monitor.evaluationFrequency * 1000; // Convert to milliseconds
    
    // Handle active hours restriction
    if (monitor.activeHours) {
      const nextActiveTime = this.getNextActiveTime(monitor.activeHours, now);
      if (nextActiveTime > now) {
        return nextActiveTime;
      }
    }
    
    // Add some jitter to prevent thundering herd
    const jitter = Math.random() * frequency * 0.1; // Up to 10% jitter
    return new Date(now.getTime() + frequency + jitter);
  }
  
  private getNextActiveTime(activeHours: ScheduleWindow, from: Date): Date {
    // Convert time strings to Date objects in the monitor's timezone
    // ... timezone calculation logic ...
    
    // Find next time within active hours
    // ... active hours calculation logic ...
    
    return from; // Simplified for brevity
  }
}
```

### Email Notification Queue

```typescript
// Email notification worker implementation
export async function processEmailNotification(
  job: Job<EmailNotificationJob>
): Promise<void> {
  const { notificationId, priority } = job.data;
  
  try {
    // Get notification details
    const notification = await getNotificationById(notificationId);
    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }
    
    // Choose email service based on priority
    const emailService = priority === 'high' 
      ? new PrimaryEmailService() 
      : new BulkEmailService();
    
    // Send email
    const result = await emailService.sendEmail({
      to: notification.recipientEmail,
      subject: notification.subject,
      html: notification.bodyHtml,
      text: notification.bodyText,
      messageId: notification.id,
    });
    
    // Update notification status
    await updateNotificationStatus(notificationId, {
      deliveryStatus: 'sent',
      providerMessageId: result.messageId,
      deliveryTimestamp: new Date(),
    });
    
    // Track metrics
    await recordEmailMetric('sent', {
      provider: emailService.getProviderName(),
      priority,
      processingTimeMs: job.processedOn ? Date.now() - job.processedOn : 0,
    });
    
  } catch (error) {
    // Log error
    console.error(`Failed to send email notification ${notificationId}:`, error);
    
    // Update notification with error
    await updateNotificationStatus(notificationId, {
      deliveryStatus: 'failed',
      bounceReason: error.message,
    });
    
    // Track failure
    await recordEmailMetric('failed', { error: error.message });
    
    throw error; // Re-throw for BullMQ retry handling
  }
}
```

### Retry and Dead Letter Queue Handling

```typescript
export class DeadLetterQueueHandler {
  private dlqQueue: Queue;
  
  constructor(private redisConnection: IORedis.Redis) {
    this.dlqQueue = new Queue('dead-letter-queue', {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    });
    
    this.setupFailedJobHandler();
  }
  
  private setupFailedJobHandler(): void {
    // Listen for failed jobs from all queues
    ['monitor-evaluation', 'email-notification', 'fact-extraction'].forEach(queueName => {
      const queue = new Queue(queueName, { connection: this.redisConnection });
      
      queue.on('failed', async (job, error) => {
        if (job.attemptsMade >= job.opts.attempts) {
          await this.moveToDeadLetterQueue(job, error);
        }
      });
    });
  }
  
  private async moveToDeadLetterQueue(job: Job, error: Error): Promise<void> {
    await this.dlqQueue.add(
      'failed-job',
      {
        originalQueue: job.queueName,
        originalJobId: job.id,
        originalData: job.data,
        failureReason: error.message,
        failureStack: error.stack,
        attemptsMade: job.attemptsMade,
        failedAt: new Date(),
      },
      {
        priority: this.calculateDLQPriority(job),
      }
    );
    
    // Alert administrators for critical failures
    if (this.isCriticalJob(job)) {
      await this.sendCriticalFailureAlert(job, error);
    }
  }
  
  private calculateDLQPriority(job: Job): number {
    // Higher priority for user-facing features
    if (job.queueName === 'email-notification') return 10;
    if (job.queueName === 'monitor-evaluation') return 5;
    return 1;
  }
  
  private isCriticalJob(job: Job): boolean {
    return job.queueName === 'email-notification' && 
           job.data.priority === 'high';
  }
  
  async retryFailedJob(dlqJobId: string): Promise<void> {
    const dlqJob = await this.dlqQueue.getJob(dlqJobId);
    if (!dlqJob) {
      throw new Error(`DLQ job ${dlqJobId} not found`);
    }
    
    const { originalQueue, originalData } = dlqJob.data;
    
    // Re-add to original queue with reduced retry count
    const originalQueueInstance = new Queue(originalQueue, { 
      connection: this.redisConnection 
    });
    
    await originalQueueInstance.add(originalQueue, originalData, {
      attempts: 1, // Single retry attempt
      priority: 1, // Lower priority
    });
    
    // Mark DLQ job as processed
    await dlqJob.update({ ...dlqJob.data, retriedAt: new Date() });
  }
}
```

## Security Architecture

### Authentication Flow

```typescript
// JWT-based authentication with refresh token rotation
export class AuthenticationService {
  private jwtSecret: string;
  private refreshTokens: Map<string, RefreshTokenData> = new Map();
  
  constructor(
    private userRepository: UserRepository,
    private redisClient: IORedis.Redis
  ) {
    this.jwtSecret = process.env.JWT_SECRET!;
  }
  
  async authenticate(email: string, password: string): Promise<AuthResult> {
    // Rate limiting check
    await this.checkRateLimit(`auth:${email}`);
    
    // Find user
    const user = await this.userRepository.findByEmail(email);
    if (!user || !user.isActive) {
      await this.recordFailedAttempt(email);
      throw new AuthenticationError('Invalid credentials');
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      await this.recordFailedAttempt(email);
      throw new AuthenticationError('Invalid credentials');
    }
    
    // Check beta access
    if (!user.betaWhitelist) {
      throw new AuthenticationError('Beta access required');
    }
    
    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);
    
    // Update last login
    await this.userRepository.updateLastLogin(user.id);
    
    // Clear failed attempts
    await this.clearFailedAttempts(email);
    
    return {
      accessToken,
      refreshToken,
      user: this.sanitizeUser(user),
      expiresIn: 24 * 60 * 60, // 24 hours
    };
  }
  
  private generateAccessToken(user: User): string {
    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
      type: 'access',
    };
    
    return jwt.sign(payload, this.jwtSecret, { algorithm: 'HS256' });
  }
  
  private async generateRefreshToken(user: User): Promise<string> {
    const tokenId = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString('hex');
    
    const refreshTokenData: RefreshTokenData = {
      userId: user.id,
      tokenId,
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      lastUsedAt: new Date(),
    };
    
    // Store in Redis with expiration
    await this.redisClient.setex(
      `refresh_token:${token}`,
      30 * 24 * 60 * 60, // 30 days
      JSON.stringify(refreshTokenData)
    );
    
    return token;
  }
  
  async refreshTokens(refreshToken: string): Promise<AuthResult> {
    // Get refresh token data
    const tokenData = await this.redisClient.get(`refresh_token:${refreshToken}`);
    if (!tokenData) {
      throw new AuthenticationError('Invalid refresh token');
    }
    
    const refreshTokenData: RefreshTokenData = JSON.parse(tokenData);
    
    // Check expiration
    if (new Date() > refreshTokenData.expiresAt) {
      await this.redisClient.del(`refresh_token:${refreshToken}`);
      throw new AuthenticationError('Refresh token expired');
    }
    
    // Get user
    const user = await this.userRepository.findById(refreshTokenData.userId);
    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }
    
    // Generate new tokens
    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = await this.generateRefreshToken(user);
    
    // Invalidate old refresh token (rotation)
    await this.redisClient.del(`refresh_token:${refreshToken}`);
    
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: this.sanitizeUser(user),
      expiresIn: 24 * 60 * 60,
    };
  }
}
```

### OAuth2 Integration

```typescript
export class OAuth2Service {
  private googleOAuth2Client: OAuth2Client;
  
  constructor() {
    this.googleOAuth2Client = new OAuth2Client({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
    });
  }
  
  getGoogleAuthUrl(): string {
    return this.googleOAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
      prompt: 'consent',
    });
  }
  
  async handleGoogleCallback(code: string): Promise<AuthResult> {
    try {
      // Exchange code for tokens
      const { tokens } = await this.googleOAuth2Client.getToken(code);
      this.googleOAuth2Client.setCredentials(tokens);
      
      // Get user info
      const userInfo = await this.getGoogleUserInfo(tokens.access_token!);
      
      // Find or create user
      let user = await this.userRepository.findByOAuth('google', userInfo.id);
      
      if (!user) {
        user = await this.createUserFromOAuth(userInfo);
      } else {
        // Update user info
        await this.updateUserFromOAuth(user.id, userInfo);
      }
      
      // Generate our tokens
      const accessToken = this.authService.generateAccessToken(user);
      const refreshToken = await this.authService.generateRefreshToken(user);
      
      return {
        accessToken,
        refreshToken,
        user: this.authService.sanitizeUser(user),
        expiresIn: 24 * 60 * 60,
      };
      
    } catch (error) {
      throw new AuthenticationError(`OAuth2 authentication failed: ${error.message}`);
    }
  }
  
  private async getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch Google user info');
    }
    
    return response.json();
  }
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
  verified_email: boolean;
}
```

### Data Encryption Approach

```typescript
export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyDerivationRounds = 100000;
  
  constructor(private masterKey: string) {}
  
  async encryptPII(data: string, userId: string): Promise<EncryptedData> {
    // Derive user-specific key
    const salt = crypto.randomBytes(32);
    const key = crypto.pbkdf2Sync(
      this.masterKey + userId, 
      salt, 
      this.keyDerivationRounds, 
      32, 
      'sha256'
    );
    
    // Encrypt data
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, key);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }
  
  async decryptPII(encryptedData: EncryptedData, userId: string): Promise<string> {
    // Derive the same key
    const salt = Buffer.from(encryptedData.salt, 'hex');
    const key = crypto.pbkdf2Sync(
      this.masterKey + userId,
      salt,
      this.keyDerivationRounds,
      32,
      'sha256'
    );
    
    // Decrypt data
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    
    const decipher = crypto.createDecipher(this.algorithm, key);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

interface EncryptedData {
  encrypted: string;
  salt: string;
  iv: string;
  authTag: string;
}
```

### API Security Headers

```typescript
export class SecurityMiddleware {
  static applySecurityHeaders(): express.RequestHandler {
    return (req, res, next) => {
      // Strict Transport Security
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      
      // Content Security Policy
      res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' *.vercel.app",
        "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
        "font-src 'self' fonts.gstatic.com",
        "img-src 'self' data: *.amazonaws.com",
        "connect-src 'self' *.anthropic.com *.openai.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
      ].join('; '));
      
      // X-Frame-Options
      res.setHeader('X-Frame-Options', 'DENY');
      
      // X-Content-Type-Options
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // X-XSS-Protection
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      // Referrer Policy
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // Remove server header
      res.removeHeader('X-Powered-By');
      
      next();
    };
  }
  
  static validateInput(): express.RequestHandler {
    return (req, res, next) => {
      // Sanitize common XSS patterns
      const sanitize = (obj: any): any => {
        if (typeof obj === 'string') {
          return obj
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
        }
        if (typeof obj === 'object' && obj !== null) {
          const sanitized: any = {};
          for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitize(value);
          }
          return sanitized;
        }
        return obj;
      };
      
      if (req.body) {
        req.body = sanitize(req.body);
      }
      if (req.query) {
        req.query = sanitize(req.query);
      }
      
      next();
    };
  }
}
```

### Rate Limiting Implementation

```typescript
export class RateLimitService {
  constructor(private redisClient: IORedis.Redis) {}
  
  createRateLimit(options: RateLimitOptions): express.RequestHandler {
    return async (req, res, next) => {
      const key = this.generateKey(req, options);
      const window = options.windowMs;
      const limit = options.max;
      
      try {
        // Sliding window rate limiting using Redis
        const current = await this.getCurrentCount(key, window);
        
        if (current >= limit) {
          // Add rate limit headers
          res.setHeader('X-RateLimit-Limit', limit);
          res.setHeader('X-RateLimit-Remaining', 0);
          res.setHeader('X-RateLimit-Reset', new Date(Date.now() + window));
          
          return res.status(429).json({
            error: {
              code: 'RATE_LIMITED',
              message: 'Rate limit exceeded. Please try again later.',
              retryAfter: window / 1000,
            },
          });
        }
        
        // Increment counter
        await this.incrementCounter(key, window);
        
        // Add success headers
        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current - 1));
        
        next();
        
      } catch (error) {
        // If Redis is down, allow request but log error
        console.error('Rate limiting service error:', error);
        next();
      }
    };
  }
  
  private generateKey(req: express.Request, options: RateLimitOptions): string {
    const userId = req.user?.id;
    const ip = req.ip;
    
    if (userId && options.keyGenerator === 'user') {
      return `rate_limit:user:${userId}:${options.name}`;
    }
    
    return `rate_limit:ip:${ip}:${options.name}`;
  }
  
  private async getCurrentCount(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    const fullKey = `${key}:${window}`;
    
    const count = await this.redisClient.get(fullKey);
    return parseInt(count || '0', 10);
  }
  
  private async incrementCounter(key: string, windowMs: number): Promise<void> {
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    const fullKey = `${key}:${window}`;
    
    const pipeline = this.redisClient.pipeline();
    pipeline.incr(fullKey);
    pipeline.expire(fullKey, Math.ceil(windowMs / 1000));
    await pipeline.exec();
  }
}

interface RateLimitOptions {
  name: string;
  windowMs: number;
  max: number;
  keyGenerator?: 'ip' | 'user';
}
```

## Performance Optimizations

### Redis Caching Strategy

```typescript
export class CacheService {
  private client: IORedis.Redis;
  private defaultTTL = 300; // 5 minutes
  
  constructor(redisConnection: IORedis.Redis) {
    this.client = redisConnection;
  }
  
  // Monitor fact caching
  async getCachedFact(monitorId: string): Promise<MonitorFact | null> {
    const key = `fact:${monitorId}:latest`;
    const cached = await this.client.get(key);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    return null;
  }
  
  async cacheFact(fact: MonitorFact, ttl: number = this.defaultTTL): Promise<void> {
    const key = `fact:${fact.monitorId}:latest`;
    await this.client.setex(key, ttl, JSON.stringify(fact));
    
    // Also cache in sorted set for history queries
    const historyKey = `fact_history:${fact.monitorId}`;
    await this.client.zadd(
      historyKey,
      fact.extractedAt.getTime(),
      JSON.stringify(fact)
    );
    
    // Keep only last 100 facts in cache
    await this.client.zremrangebyrank(historyKey, 0, -101);
  }
  
  // Dashboard data caching
  async getCachedDashboard(userId: string): Promise<DashboardData | null> {
    const key = `dashboard:${userId}`;
    const cached = await this.client.get(key);
    
    if (cached) {
      const data = JSON.parse(cached);
      
      // Check if any monitors have been updated since cache
      const lastUpdate = new Date(data.cachedAt);
      const hasUpdates = await this.checkForUpdates(userId, lastUpdate);
      
      if (!hasUpdates) {
        return data;
      }
    }
    
    return null;
  }
  
  async cacheDashboard(
    userId: string, 
    data: DashboardData, 
    ttl: number = 60
  ): Promise<void> {
    const key = `dashboard:${userId}`;
    const cacheData = {
      ...data,
      cachedAt: new Date().toISOString(),
    };
    
    await this.client.setex(key, ttl, JSON.stringify(cacheData));
  }
  
  // Query result caching with smart invalidation
  async getCachedQuery(
    queryKey: string, 
    params: Record<string, any>
  ): Promise<any | null> {
    const key = this.generateQueryKey(queryKey, params);
    const cached = await this.client.hgetall(key);
    
    if (cached && cached.data) {
      const ttl = await this.client.ttl(key);
      
      return {
        data: JSON.parse(cached.data),
        cachedAt: cached.cachedAt,
        expiresIn: ttl,
      };
    }
    
    return null;
  }
  
  async cacheQuery(
    queryKey: string,
    params: Record<string, any>,
    data: any,
    ttl: number = this.defaultTTL,
    tags: string[] = []
  ): Promise<void> {
    const key = this.generateQueryKey(queryKey, params);
    
    const cacheData = {
      data: JSON.stringify(data),
      cachedAt: new Date().toISOString(),
      tags: JSON.stringify(tags),
    };
    
    await this.client.hmset(key, cacheData);
    await this.client.expire(key, ttl);
    
    // Add to tag sets for invalidation
    for (const tag of tags) {
      await this.client.sadd(`tag:${tag}`, key);
      await this.client.expire(`tag:${tag}`, ttl * 2); // Tags live longer
    }
  }
  
  async invalidateByTags(tags: string[]): Promise<void> {
    const pipeline = this.client.pipeline();
    
    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      const keys = await this.client.smembers(tagKey);
      
      if (keys.length > 0) {
        pipeline.del(...keys);
        pipeline.del(tagKey);
      }
    }
    
    await pipeline.exec();
  }
  
  private generateQueryKey(queryKey: string, params: Record<string, any>): string {
    const paramsStr = JSON.stringify(params, Object.keys(params).sort());
    const hash = crypto.createHash('md5').update(paramsStr).digest('hex');
    return `query:${queryKey}:${hash}`;
  }
}
```

### Database Query Optimization

```typescript
export class OptimizedMonitorRepository {
  constructor(private db: Pool) {}
  
  // Optimized query for active monitors dashboard
  async getActiveMonitorsSummary(userId: string): Promise<MonitorSummary[]> {
    const query = `
      WITH latest_facts AS (
        SELECT DISTINCT ON (monitor_id) 
          monitor_id,
          fact_value,
          extracted_at,
          confidence_score
        FROM monitor_facts mf
        WHERE mf.monitor_id IN (
          SELECT id FROM monitors WHERE user_id = $1 AND is_active = true
        )
        ORDER BY monitor_id, extracted_at DESC
      ),
      recent_triggers AS (
        SELECT 
          monitor_id,
          COUNT(*) as trigger_count,
          MAX(triggered_at) as last_triggered
        FROM monitor_triggers mt
        WHERE mt.triggered_at >= NOW() - INTERVAL '24 hours'
          AND mt.monitor_id IN (
            SELECT id FROM monitors WHERE user_id = $1 AND is_active = true
          )
        GROUP BY monitor_id
      )
      SELECT 
        m.id,
        m.name,
        m.monitor_type,
        m.is_active,
        m.next_evaluation_at,
        m.last_evaluation_at,
        lf.fact_value as current_value,
        lf.extracted_at as last_fact_at,
        lf.confidence_score,
        COALESCE(rt.trigger_count, 0) as today_trigger_count,
        rt.last_triggered
      FROM monitors m
      LEFT JOIN latest_facts lf ON m.id = lf.monitor_id
      LEFT JOIN recent_triggers rt ON m.id = rt.monitor_id
      WHERE m.user_id = $1 AND m.is_active = true
      ORDER BY m.last_evaluation_at DESC NULLS LAST;
    `;
    
    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => this.mapToMonitorSummary(row));
  }
  
  // Optimized historical data query with aggregation
  async getFactHistory(
    monitorId: string,
    timeRange: TimeRange,
    aggregation?: 'hour' | 'day' | 'week'
  ): Promise<FactHistoryPoint[]> {
    let query: string;
    let params: any[] = [monitorId, timeRange.start, timeRange.end];
    
    if (aggregation) {
      // Aggregated query for large time ranges
      query = `
        SELECT 
          DATE_TRUNC($4, recorded_at) as time_bucket,
          AVG((current_value->>'value')::numeric) as avg_value,
          MIN((current_value->>'value')::numeric) as min_value,
          MAX((current_value->>'value')::numeric) as max_value,
          COUNT(*) as data_points,
          BOOL_OR(change_detected) as had_changes
        FROM fact_history
        WHERE monitor_id = $1 
          AND recorded_at BETWEEN $2 AND $3
        GROUP BY time_bucket
        ORDER BY time_bucket;
      `;
      params.push(aggregation);
    } else {
      // Raw data query for smaller time ranges
      query = `
        SELECT 
          recorded_at,
          current_value,
          change_detected,
          change_magnitude,
          change_percentage
        FROM fact_history
        WHERE monitor_id = $1 
          AND recorded_at BETWEEN $2 AND $3
        ORDER BY recorded_at
        LIMIT 10000; -- Prevent excessive data transfer
      `;
    }
    
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapToFactHistoryPoint(row, aggregation));
  }
  
  // Optimized batch operations for monitor evaluation
  async batchUpdateNextEvaluation(updates: Array<{id: string, nextEvaluationAt: Date}>): Promise<void> {
    if (updates.length === 0) return;
    
    const values = updates.map((update, index) => 
      `($${index * 2 + 1}, $${index * 2 + 2})`
    ).join(', ');
    
    const params = updates.flatMap(update => [update.id, update.nextEvaluationAt]);
    
    const query = `
      UPDATE monitors 
      SET 
        next_evaluation_at = v.next_eval,
        updated_at = CURRENT_TIMESTAMP
      FROM (VALUES ${values}) AS v(id, next_eval)
      WHERE monitors.id::text = v.id;
    `;
    
    await this.db.query(query, params);
  }
}

interface TimeRange {
  start: Date;
  end: Date;
}

interface MonitorSummary {
  id: string;
  name: string;
  monitorType: string;
  isActive: boolean;
  nextEvaluationAt?: Date;
  lastEvaluationAt?: Date;
  currentValue: any;
  lastFactAt?: Date;
  confidenceScore?: number;
  todayTriggerCount: number;
  lastTriggered?: Date;
}
```

### API Response Caching

```typescript
export class APIResponseCache {
  constructor(private cacheService: CacheService) {}
  
  // Cache middleware for API responses
  cacheResponse(options: CacheOptions): express.RequestHandler {
    return async (req, res, next) => {
      const cacheKey = this.generateCacheKey(req, options);
      
      // Try to get from cache
      const cached = await this.cacheService.getCachedQuery(
        cacheKey,
        { url: req.originalUrl, user: req.user?.id }
      );
      
      if (cached && !this.shouldBypassCache(req, options)) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Age', 
          Math.floor((Date.now() - new Date(cached.cachedAt).getTime()) / 1000)
        );
        
        return res.json(cached.data);
      }
      
      // Cache miss - intercept response
      const originalJson = res.json;
      res.json = function(data: any) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Don't cache sensitive data
          if (!containsSensitiveData(data)) {
            const tags = generateCacheTags(req, data);
            
            cacheService.cacheQuery(
              cacheKey,
              { url: req.originalUrl, user: req.user?.id },
              data,
              options.ttl,
              tags
            ).catch(error => {
              console.warn('Failed to cache response:', error);
            });
          }
        }
        
        res.setHeader('X-Cache', 'MISS');
        return originalJson.call(this, data);
      };
      
      next();
    };
  }
  
  private generateCacheKey(req: express.Request, options: CacheOptions): string {
    const baseKey = options.keyPrefix || req.route?.path || req.path;
    
    // Include user ID for user-specific endpoints
    if (options.userSpecific && req.user) {
      return `api:${baseKey}:user:${req.user.id}`;
    }
    
    // Include query parameters if specified
    if (options.includeQuery) {
      const queryStr = JSON.stringify(req.query, Object.keys(req.query).sort());
      const hash = crypto.createHash('md5').update(queryStr).digest('hex');
      return `api:${baseKey}:query:${hash}`;
    }
    
    return `api:${baseKey}`;
  }
  
  private shouldBypassCache(req: express.Request, options: CacheOptions): boolean {
    // Bypass if explicitly requested
    if (req.headers['cache-control'] === 'no-cache') {
      return true;
    }
    
    // Bypass for real-time endpoints during high activity
    if (options.bypassOnHighActivity) {
      const userActivityLevel = getUserActivityLevel(req.user?.id);
      if (userActivityLevel === 'high') {
        return true;
      }
    }
    
    return false;
  }
}

interface CacheOptions {
  ttl: number;
  keyPrefix?: string;
  userSpecific?: boolean;
  includeQuery?: boolean;
  bypassOnHighActivity?: boolean;
  maxAge?: number;
}

function containsSensitiveData(data: any): boolean {
  const sensitivePatterns = [
    /password/i,
    /token/i,
    /secret/i,
    /key/i,
    /oauth/i
  ];
  
  const dataStr = JSON.stringify(data).toLowerCase();
  return sensitivePatterns.some(pattern => pattern.test(dataStr));
}

function generateCacheTags(req: express.Request, data: any): string[] {
  const tags: string[] = [];
  
  // Add user tag for user-specific endpoints
  if (req.user) {
    tags.push(`user:${req.user.id}`);
  }
  
  // Add resource-specific tags
  if (req.params.monitorId) {
    tags.push(`monitor:${req.params.monitorId}`);
  }
  
  // Add data-based tags
  if (data.monitors) {
    data.monitors.forEach((monitor: any) => {
      tags.push(`monitor:${monitor.id}`);
    });
  }
  
  return tags;
}
```

### Frontend Bundle Optimization

```typescript
// SvelteKit configuration for optimal bundling
// vite.config.js
export default defineConfig({
  plugins: [sveltekit()],
  optimizeDeps: {
    include: ['chart.js', 'date-fns', 'lodash-es']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk for stable third-party libraries
          vendor: ['svelte', '@sveltejs/kit'],
          
          // Charts chunk (loaded on demand)
          charts: ['chart.js', 'chartjs-adapter-date-fns'],
          
          // Utils chunk for shared utilities
          utils: ['date-fns', 'lodash-es', 'zod'],
          
          // Auth chunk for authentication pages
          auth: ['@auth/core', '@auth/sveltekit']
        }
      }
    },
    
    // Code splitting for better caching
    chunkSizeWarningLimit: 1000,
    
    // Asset optimization
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb
    
    // Minification
    minify: 'esbuild',
    target: 'esnext'
  }
});

// Component-level code splitting
// src/lib/components/LazyChart.svelte
<script>
  import { onMount } from 'svelte';
  
  export let data;
  export let type = 'line';
  
  let chartComponent;
  let mounted = false;
  
  onMount(async () => {
    // Lazy load chart component
    const { default: Chart } = await import('./Chart.svelte');
    chartComponent = Chart;
    mounted = true;
  });
</script>

{#if mounted && chartComponent}
  <svelte:component this={chartComponent} {data} {type} />
{:else}
  <div class="chart-skeleton">Loading chart...</div>
{/if}
```

## Monitoring and Observability

### Application Metrics

```typescript
export class MetricsService {
  private registry = new Registry();
  private httpMetrics: Map<string, Histogram> = new Map();
  
  constructor() {
    this.initializeMetrics();
  }
  
  private initializeMetrics(): void {
    // HTTP request duration
    const httpDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
    });
    this.registry.registerMetric(httpDuration);
    this.httpMetrics.set('duration', httpDuration);
    
    // HTTP request count
    const httpCount = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });
    this.registry.registerMetric(httpCount);
    
    // Monitor evaluation metrics
    const evaluationDuration = new Histogram({
      name: 'monitor_evaluation_duration_seconds',
      help: 'Monitor evaluation duration in seconds',
      labelNames: ['monitor_type', 'success'],
      buckets: [1, 5, 10, 30, 60, 120, 300],
    });
    this.registry.registerMetric(evaluationDuration);
    
    // AI provider metrics
    const aiRequestDuration = new Histogram({
      name: 'ai_request_duration_seconds',
      help: 'AI provider request duration in seconds',
      labelNames: ['provider', 'operation', 'success'],
      buckets: [0.5, 1, 2, 5, 10, 20, 30],
    });
    this.registry.registerMetric(aiRequestDuration);
    
    // Email delivery metrics
    const emailDelivery = new Counter({
      name: 'emails_sent_total',
      help: 'Total emails sent',
      labelNames: ['provider', 'status', 'notification_type'],
    });
    this.registry.registerMetric(emailDelivery);
    
    // Database metrics
    const dbQueryDuration = new Histogram({
      name: 'database_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['query_type', 'success'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    });
    this.registry.registerMetric(dbQueryDuration);
    
    // Cache metrics
    const cacheHitRate = new Counter({
      name: 'cache_operations_total',
      help: 'Total cache operations',
      labelNames: ['operation', 'result'], // result: 'hit' | 'miss' | 'error'
    });
    this.registry.registerMetric(cacheHitRate);
    
    // Business metrics
    const activeMonitors = new Gauge({
      name: 'monitors_active_total',
      help: 'Total number of active monitors',
      labelNames: ['monitor_type'],
    });
    this.registry.registerMetric(activeMonitors);
    
    const userActivity = new Counter({
      name: 'user_activity_total',
      help: 'Total user activities',
      labelNames: ['activity_type', 'user_type'], // user_type: 'beta' | 'regular'
    });
    this.registry.registerMetric(userActivity);
  }
  
  // HTTP middleware for automatic metrics collection
  httpMetricsMiddleware(): express.RequestHandler {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const labels = {
          method: req.method,
          route: req.route?.path || req.path,
          status_code: res.statusCode.toString(),
        };
        
        this.httpMetrics.get('duration')?.observe(labels, duration);
        this.recordCounter('http_requests_total', 1, labels);
      });
      
      next();
    };
  }
  
  // Helper methods for recording metrics
  recordHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const metric = this.registry.getSingleMetric(name) as Histogram;
    metric?.observe(labels, value);
  }
  
  recordCounter(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    const metric = this.registry.getSingleMetric(name) as Counter;
    metric?.inc(labels, value);
  }
  
  recordGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const metric = this.registry.getSingleMetric(name) as Gauge;
    metric?.set(labels, value);
  }
  
  // Metrics export endpoint
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
```

### Error Tracking

```typescript
export class ErrorTrackingService {
  private errorCounts: Map<string, number> = new Map();
  private alertThresholds = {
    errorRate: 0.05, // 5% error rate
    errorCount: 10,  // 10 errors per minute
  };
  
  constructor(
    private metricsService: MetricsService,
    private alertService: AlertService
  ) {}
  
  async trackError(error: Error, context: ErrorContext): Promise<void> {
    // Categorize error
    const errorType = this.categorizeError(error);
    const severity = this.determineSeverity(error, context);
    
    // Record metrics
    this.metricsService.recordCounter('errors_total', 1, {
      error_type: errorType,
      severity,
      component: context.component,
      operation: context.operation,
    });
    
    // Store error details for analysis
    const errorRecord: ErrorRecord = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      message: error.message,
      stack: error.stack || '',
      type: errorType,
      severity,
      context,
      fingerprint: this.generateFingerprint(error),
    };
    
    await this.storeError(errorRecord);
    
    // Check for alert conditions
    await this.checkAlertThresholds(errorType, severity);
    
    // Send to external error tracking (if configured)
    if (process.env.SENTRY_DSN) {
      await this.sendToSentry(errorRecord);
    }
  }
  
  private categorizeError(error: Error): ErrorType {
    if (error.name === 'ValidationError') return 'validation';
    if (error.name === 'AuthenticationError') return 'authentication';
    if (error.message.includes('database')) return 'database';
    if (error.message.includes('AI') || error.message.includes('OpenAI') || error.message.includes('Claude')) return 'ai_provider';
    if (error.message.includes('email')) return 'email_service';
    if (error.message.includes('timeout')) return 'timeout';
    if (error.message.includes('network')) return 'network';
    
    return 'application';
  }
  
  private determineSeverity(error: Error, context: ErrorContext): ErrorSeverity {
    // Critical errors that affect core functionality
    if (context.operation === 'user_authentication' || 
        context.operation === 'monitor_evaluation' ||
        context.operation === 'email_notification') {
      return 'critical';
    }
    
    // High severity for user-facing features
    if (context.component === 'api' && context.userId) {
      return 'high';
    }
    
    // Medium for background tasks
    if (context.component === 'background_job') {
      return 'medium';
    }
    
    return 'low';
  }
  
  private generateFingerprint(error: Error): string {
    // Create a unique fingerprint for grouping similar errors
    const key = `${error.name}:${error.message}:${error.stack?.split('\n')[1] || ''}`;
    return crypto.createHash('md5').update(key).digest('hex').substr(0, 8);
  }
  
  private async checkAlertThresholds(errorType: ErrorType, severity: ErrorSeverity): Promise<void> {
    if (severity === 'critical') {
      // Always alert on critical errors
      await this.alertService.sendAlert({
        level: 'critical',
        title: `Critical Error: ${errorType}`,
        description: `A critical error occurred in the ${errorType} component`,
        timestamp: new Date(),
      });
    }
    
    // Check error rate over last 5 minutes
    const recentErrorRate = await this.getRecentErrorRate(errorType);
    if (recentErrorRate > this.alertThresholds.errorRate) {
      await this.alertService.sendAlert({
        level: 'warning',
        title: `High Error Rate: ${errorType}`,
        description: `Error rate for ${errorType} is ${(recentErrorRate * 100).toFixed(1)}%`,
        timestamp: new Date(),
      });
    }
  }
  
  private async getRecentErrorRate(errorType: ErrorType): Promise<number> {
    // Get error count vs total operations for the last 5 minutes
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    // This would typically query your metrics store
    // Simplified implementation
    const errorCount = this.errorCounts.get(`${errorType}:${Math.floor(now / 60000)}`) || 0;
    const totalOperations = 100; // This should come from actual metrics
    
    return errorCount / Math.max(totalOperations, 1);
  }
}

interface ErrorContext {
  component: string;
  operation: string;
  userId?: string;
  monitorId?: string;
  requestId?: string;
  additionalData?: Record<string, any>;
}

interface ErrorRecord {
  id: string;
  timestamp: Date;
  message: string;
  stack: string;
  type: ErrorType;
  severity: ErrorSeverity;
  context: ErrorContext;
  fingerprint: string;
}

type ErrorType = 
  | 'validation' 
  | 'authentication' 
  | 'database' 
  | 'ai_provider' 
  | 'email_service' 
  | 'timeout' 
  | 'network' 
  | 'application';

type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
```

### Performance Monitoring

```typescript
export class PerformanceMonitor {
  private performanceObserver: PerformanceObserver | null = null;
  
  constructor(private metricsService: MetricsService) {
    this.initializePerformanceTracking();
  }
  
  private initializePerformanceTracking(): void {
    if (typeof PerformanceObserver !== 'undefined') {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.handlePerformanceEntry(entry);
        }
      });
      
      this.performanceObserver.observe({ 
        entryTypes: ['navigation', 'resource', 'measure', 'paint'] 
      });
    }
  }
  
  private handlePerformanceEntry(entry: PerformanceEntry): void {
    switch (entry.entryType) {
      case 'navigation':
        this.trackNavigationTiming(entry as PerformanceNavigationTiming);
        break;
      case 'resource':
        this.trackResourceTiming(entry as PerformanceResourceTiming);
        break;
      case 'measure':
        this.trackCustomMeasure(entry);
        break;
      case 'paint':
        this.trackPaintTiming(entry as PerformancePaintTiming);
        break;
    }
  }
  
  private trackNavigationTiming(entry: PerformanceNavigationTiming): void {
    const metrics = {
      dns_lookup: entry.domainLookupEnd - entry.domainLookupStart,
      tcp_connect: entry.connectEnd - entry.connectStart,
      ssl_handshake: entry.connectEnd - entry.secureConnectionStart,
      ttfb: entry.responseStart - entry.requestStart, // Time to First Byte
      response_time: entry.responseEnd - entry.responseStart,
      dom_processing: entry.domComplete - entry.domLoading,
      load_complete: entry.loadEventEnd - entry.navigationStart,
    };
    
    for (const [name, value] of Object.entries(metrics)) {
      if (value > 0) {
        this.metricsService.recordHistogram(
          'browser_performance_seconds',
          value / 1000, // Convert to seconds
          { metric: name }
        );
      }
    }
  }
  
  private trackResourceTiming(entry: PerformanceResourceTiming): void {
    const resourceType = this.getResourceType(entry.name);
    const duration = entry.responseEnd - entry.startTime;
    
    this.metricsService.recordHistogram(
      'resource_load_duration_seconds',
      duration / 1000,
      { 
        resource_type: resourceType,
        cached: entry.transferSize === 0 ? 'true' : 'false'
      }
    );
  }
  
  // Custom performance tracking for application operations
  async trackOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    tags: Record<string, string> = {}
  ): Promise<T> {
    const start = performance.now();
    let success = true;
    let result: T;
    
    try {
      result = await fn();
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = (performance.now() - start) / 1000;
      
      this.metricsService.recordHistogram(
        'operation_duration_seconds',
        duration,
        {
          operation,
          success: success.toString(),
          ...tags
        }
      );
    }
  }
  
  // Track API call performance
  trackAPICall(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    responseSize?: number
  ): void {
    this.metricsService.recordHistogram(
      'api_call_duration_seconds',
      duration / 1000,
      {
        endpoint: endpoint.replace(/\/\d+/g, '/:id'), // Normalize IDs
        method,
        status_code: statusCode.toString(),
        success: statusCode < 400 ? 'true' : 'false'
      }
    );
    
    if (responseSize) {
      this.metricsService.recordHistogram(
        'api_response_size_bytes',
        responseSize,
        { endpoint: endpoint.replace(/\/\d+/g, '/:id') }
      );
    }
  }
  
  // Database query performance tracking
  async trackDatabaseQuery<T>(
    query: string,
    queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
    fn: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    let success = true;
    
    try {
      const result = await fn();
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = (performance.now() - start) / 1000;
      
      this.metricsService.recordHistogram(
        'database_query_duration_seconds',
        duration,
        {
          query_type: queryType,
          success: success.toString()
        }
      );
    }
  }
  
  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'javascript';
    if (url.includes('.css')) return 'stylesheet';
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
    if (url.includes('/api/')) return 'api';
    return 'other';
  }
}
```

### Health Check Endpoints

```typescript
export class HealthCheckService {
  private checks: Map<string, HealthCheck> = new Map();
  
  constructor(
    private db: Pool,
    private redis: IORedis.Redis,
    private aiProvider: IMonitorAI,
    private emailService: EmailService
  ) {
    this.registerHealthChecks();
  }
  
  private registerHealthChecks(): void {
    // Database health check
    this.checks.set('database', {
      name: 'PostgreSQL Database',
      check: async () => {
        const start = Date.now();
        const result = await this.db.query('SELECT 1');
        const responseTime = Date.now() - start;
        
        return {
          status: result.rows.length === 1 ? 'healthy' : 'unhealthy',
          responseTime,
          details: { connected: true, responseTimeMs: responseTime }
        };
      },
      timeout: 5000,
      critical: true
    });
    
    // Redis health check
    this.checks.set('redis', {
      name: 'Redis Cache',
      check: async () => {
        const start = Date.now();
        await this.redis.ping();
        const responseTime = Date.now() - start;
        
        return {
          status: 'healthy',
          responseTime,
          details: { connected: true, responseTimeMs: responseTime }
        };
      },
      timeout: 5000,
      critical: true
    });
    
    // AI provider health check
    this.checks.set('ai_provider', {
      name: 'AI Provider',
      check: async () => {
        const start = Date.now();
        const healthy = await this.aiProvider.isHealthy();
        const responseTime = Date.now() - start;
        
        return {
          status: healthy ? 'healthy' : 'unhealthy',
          responseTime,
          details: { 
            provider: this.aiProvider.getProviderInfo().name,
            responseTimeMs: responseTime 
          }
        };
      },
      timeout: 10000,
      critical: false // Non-critical, fallback available
    });
    
    // Email service health check
    this.checks.set('email_service', {
      name: 'Email Service',
      check: async () => {
        const start = Date.now();
        const healthy = await this.emailService.checkHealth();
        const responseTime = Date.now() - start;
        
        return {
          status: healthy ? 'healthy' : 'unhealthy',
          responseTime,
          details: { responseTimeMs: responseTime }
        };
      },
      timeout: 5000,
      critical: false
    });
    
    // System metrics health check
    this.checks.set('system_metrics', {
      name: 'System Metrics',
      check: async () => {
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        const memoryUsagePercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
        const status = memoryUsagePercentage > 90 ? 'unhealthy' : 'healthy';
        
        return {
          status,
          responseTime: 1, // Immediate
          details: {
            memory: {
              used: memoryUsage.heapUsed,
              total: memoryUsage.heapTotal,
              percentage: memoryUsagePercentage.toFixed(2)
            },
            uptime: {
              seconds: uptime,
              formatted: this.formatUptime(uptime)
            }
          }
        };
      },
      timeout: 1000,
      critical: false
    });
  }
  
  async runHealthCheck(checkName?: string): Promise<HealthCheckResult> {
    if (checkName) {
      const check = this.checks.get(checkName);
      if (!check) {
        throw new Error(`Health check '${checkName}' not found`);
      }
      
      return await this.executeHealthCheck(checkName, check);
    }
    
    // Run all health checks
    const results: Record<string, HealthCheckResult> = {};
    const promises = Array.from(this.checks.entries()).map(async ([name, check]) => {
      results[name] = await this.executeHealthCheck(name, check);
    });
    
    await Promise.all(promises);
    
    // Determine overall status
    const overallStatus = this.determineOverallStatus(results);
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: results,
      version: process.env.npm_package_version || 'unknown'
    };
  }
  
  private async executeHealthCheck(name: string, check: HealthCheck): Promise<HealthCheckResult> {
    try {
      const result = await Promise.race([
        check.check(),
        new Promise<HealthCheckResult>((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), check.timeout);
        })
      ]);
      
      return {
        name: check.name,
        status: result.status,
        responseTime: result.responseTime,
        timestamp: new Date().toISOString(),
        details: result.details
      };
      
    } catch (error) {
      return {
        name: check.name,
        status: 'unhealthy',
        responseTime: check.timeout,
        timestamp: new Date().toISOString(),
        error: error.message,
        details: {}
      };
    }
  }
  
  private determineOverallStatus(results: Record<string, HealthCheckResult>): HealthStatus {
    const criticalChecks = ['database', 'redis'];
    const criticalFailures = criticalChecks.some(name => 
      results[name]?.status === 'unhealthy'
    );
    
    if (criticalFailures) {
      return 'unhealthy';
    }
    
    const anyUnhealthy = Object.values(results).some(result => 
      result.status === 'unhealthy'
    );
    
    if (anyUnhealthy) {
      return 'degraded';
    }
    
    return 'healthy';
  }
  
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    
    return `${days}d ${hours}h ${minutes}m`;
  }
  
  // Express middleware for health check endpoint
  healthCheckHandler(): express.RequestHandler {
    return async (req, res) => {
      try {
        const checkName = req.params.check;
        const result = await this.runHealthCheck(checkName);
        
        const statusCode = result.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(result);
        
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };
  }
}

interface HealthCheck {
  name: string;
  check: () => Promise<{
    status: HealthStatus;
    responseTime: number;
    details: Record<string, any>;
  }>;
  timeout: number;
  critical: boolean;
}

interface HealthCheckResult {
  name?: string;
  status: HealthStatus;
  responseTime: number;
  timestamp: string;
  details: Record<string, any>;
  error?: string;
  checks?: Record<string, HealthCheckResult>;
  version?: string;
}

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';
```

---

## Temporal Logic Separation

The MonitorHub architecture implements a sophisticated temporal logic separation that divides responsibilities between the AI system and the application logic:

### AI System Responsibilities (Current State)
- **Fact Extraction**: Interprets natural language prompts and extracts current state information from various data sources
- **Condition Evaluation**: Analyzes current facts against defined trigger conditions
- **Natural Language Understanding**: Processes user inputs to create structured monitor definitions

### System Logic Responsibilities (Historical Analysis)
- **Historical Data Storage**: Maintains complete temporal records in partitioned PostgreSQL tables
- **Change Detection**: Compares current facts against historical values to identify meaningful changes
- **Trend Analysis**: Performs statistical analysis of historical data to identify patterns
- **Temporal Query Processing**: Handles complex time-range queries and aggregations

This separation ensures:
1. **Consistency**: Historical analysis follows deterministic rules while AI provides intelligent interpretation
2. **Reliability**: System logic handles critical temporal operations with guaranteed accuracy
3. **Scalability**: AI costs remain predictable while historical analysis scales efficiently with database optimizations
4. **Maintainability**: Clear boundaries between AI-driven features and traditional application logic

---

## Deployment and Scaling Considerations

The architecture supports horizontal scaling through:

1. **Stateless API Design**: All API services are stateless and can be scaled independently
2. **Database Partitioning**: Time-based partitioning supports data growth to petabytes
3. **Queue-Based Processing**: BullMQ enables distributed background job processing
4. **Caching Strategy**: Multi-layer Redis caching reduces database load
5. **AI Provider Abstraction**: Failover and load balancing across multiple AI providers
6. **Microservices Ready**: Architecture enables future decomposition into microservices

---

## Security and Compliance

The system implements enterprise-grade security:

1. **Data Protection**: AES-256 encryption at rest, TLS 1.3 in transit
2. **Authentication**: JWT + refresh token rotation with OAuth2 support
3. **Authorization**: Role-based access control with fine-grained permissions
4. **Privacy Compliance**: GDPR-compliant data handling with export and deletion capabilities
5. **Security Monitoring**: Comprehensive audit logging and threat detection
6. **Rate Limiting**: Multi-tier rate limiting prevents abuse and ensures fair usage

---

DOCUMENT COMPLETE