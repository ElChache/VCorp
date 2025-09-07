# PROOF VALIDATION SCRIPT - 2 HOUR DEADLINE

**Created**: 2025-09-07T23:55:00Z  
**Purpose**: Provide actual proof screenshots and API responses as demanded by Product Owner  
**Deadline**: 2 hours from creation

## IMMEDIATE ACTION PLAN

### Step 1: Environment Verification (5 minutes)

**1.1 Check Development Server Status**
```bash
# Verify server is running
curl -s http://localhost:5173/ | head -5
# Expected: Should return HTML content

# Check if port 5173 is active
lsof -ti:5173
# Expected: Should return process IDs
```

**1.2 Check Database Connectivity**
```bash
# Test PostgreSQL connection (via Docker)
docker ps | grep postgres
# Expected: Should show running postgres container

# Test Redis connection (via Docker) 
docker ps | grep redis
# Expected: Should show running redis container
```

### Step 2: Basic Frontend Proof (10 minutes)

**2.1 SCREENSHOT 1: Login Page**
- Navigate to: `http://localhost:5173/login`
- Take screenshot showing login form
- **QA ACTION**: Save as `proof_01_login_page.png`

**2.2 SCREENSHOT 2: Registration Page**  
- Navigate to: `http://localhost:5173/register`
- Take screenshot showing registration form
- **QA ACTION**: Save as `proof_02_registration_page.png`

**2.3 SCREENSHOT 3: Dashboard**
- Navigate to: `http://localhost:5173/`
- Take screenshot showing dashboard (even if empty)
- **QA ACTION**: Save as `proof_03_dashboard.png`

### Step 3: API Endpoint Proof (20 minutes)

**3.1 User Registration API Test**
```bash
# Test user registration
curl -X POST http://localhost:5173/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@proof.com",
    "password": "TestPassword123!",
    "name": "Proof Test User"
  }' \
  -v

# EXPECTED RESPONSE:
# Status: 201 Created
# Body: {"user": {...}, "token": "jwt_token_here"}
```

**QA ACTION**: Copy full curl output to `proof_04_registration_api.txt`

**3.2 User Login API Test**
```bash
# Test user login  
curl -X POST http://localhost:5173/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@proof.com", 
    "password": "TestPassword123!"
  }' \
  -v

# EXPECTED RESPONSE:
# Status: 200 OK
# Body: {"user": {...}, "token": "jwt_token_here"}
```

**QA ACTION**: Copy JWT token from response for next steps, save output to `proof_05_login_api.txt`

### Step 4: AI Services Proof (30 minutes)

**4.1 AI Classification Proof Test**

**CRITICAL**: Replace `{JWT_TOKEN}` with actual token from Step 3.2

```bash
# Test AI-powered monitor creation
JWT_TOKEN="your_jwt_token_here"

curl -X POST http://localhost:5173/api/monitors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "name": "Tesla Stock Alert",
    "prompt": "Alert me when Tesla stock drops below $200"
  }' \
  -v

# EXPECTED AI CLASSIFICATION RESPONSE:
{
  "id": "monitor_xxx",
  "name": "Tesla Stock Alert", 
  "ai_classification": {
    "monitorType": "threshold",
    "entities": [{"type": "stock", "value": "TSLA", "confidence": 0.8+}],
    "conditions": [{"type": "less_than", "value": 200, "confidence": 0.7+}]
  }
}
```

**QA ACTION**: Save full response to `proof_06_ai_classification.txt`

**4.2 Monitor List API Test**
```bash
# Verify monitor was created and appears in list
curl -X GET http://localhost:5173/api/monitors \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -v

# EXPECTED: Should show the Tesla monitor in the array
```

**QA ACTION**: Save response to `proof_07_monitor_list.txt`

**4.3 AI Evaluation Proof Test** 
```bash
# Get monitor ID from previous response, then trigger evaluation
MONITOR_ID="your_monitor_id_here"

curl -X POST http://localhost:5173/api/monitors/$MONITOR_ID/evaluate \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -v

# EXPECTED: Should show evaluation with AI fact extraction
```

**QA ACTION**: Save response to `proof_08_ai_evaluation.txt`

### Step 5: Frontend Integration Proof (15 minutes)

**5.1 SCREENSHOT 4: Monitor Creation Form**
- Navigate to: `http://localhost:5173/monitors/create`  
- Fill in form with: "Alert me when Apple stock goes above $180"
- Take screenshot before submitting
- **QA ACTION**: Save as `proof_09_monitor_creation_form.png`

**5.2 SCREENSHOT 5: Dashboard with Created Monitor**
- Submit the monitor creation form
- Navigate back to dashboard: `http://localhost:5173/`
- Take screenshot showing the monitor appears in the list
- **QA ACTION**: Save as `proof_10_dashboard_with_monitors.png`

**5.3 SCREENSHOT 6: Monitor Detail View**
- Click on a monitor to view details
- Take screenshot showing monitor configuration and AI classification
- **QA ACTION**: Save as `proof_11_monitor_details.png`

### Step 6: AI Provider Health Check (10 minutes)

**6.1 AI Manager Status Check**
```bash
# Check if AI Manager is properly initialized
curl -X GET http://localhost:5173/api/health \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -v

# EXPECTED: Should show system health including AI services
```

**QA ACTION**: Save response to `proof_12_system_health.txt`

**6.2 AI Service Direct Test**
```bash
# Test AI classification service directly (if endpoint exists)
curl -X POST http://localhost:5173/api/ai/classify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"prompt": "Monitor Google stock price"}' \
  -v

# EXPECTED: Should return AI classification without creating monitor
```

**QA ACTION**: Save response to `proof_13_ai_direct_test.txt`

### Step 7: Error Handling Proof (10 minutes)

**7.1 Test AI Fallback Behavior**
```bash
# Test with intentionally ambiguous prompt
curl -X POST http://localhost:5173/api/monitors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "name": "Vague Monitor",
    "prompt": "Tell me about stuff"
  }' \
  -v

# EXPECTED: Should either:
# 1. Return AI classification with low confidence, OR  
# 2. Fall back to manual monitor creation, OR
# 3. Return helpful error with suggestions
```

**QA ACTION**: Save response to `proof_14_ai_fallback_test.txt`

### Step 8: Performance Proof (10 minutes)

**8.1 Response Time Measurement**
```bash
# Measure AI classification response time
time curl -X POST http://localhost:5173/api/monitors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "name": "Speed Test", 
    "prompt": "Alert when Bitcoin price changes by 5%"
  }' \
  -s > /dev/null

# EXPECTED: Should complete within 10 seconds (including AI processing)
```

**QA ACTION**: Record timing in `proof_15_performance_timing.txt`

## FAILURE SCENARIOS & DEBUGGING

### If Registration/Login Fails:
1. Check server logs: `docker-compose logs app`
2. Verify database connection: `docker-compose logs postgres`
3. Check for missing environment variables

### If AI Classification Fails:
1. **IMMEDIATE AI DEVELOPER SUPPORT** - Contact `ai_sonnet_003`
2. Check AI Manager initialization in logs
3. Test provider fallback (Claude → OpenAI)
4. Verify API keys are properly configured

### If Database Operations Fail:
1. **IMMEDIATE BACKEND DEVELOPER SUPPORT** - Contact `be_primary_001_23f6`
2. Check database schema migrations
3. Verify Docker containers are healthy

## PROOF DELIVERABLES CHECKLIST

**For Product Owner Review:**

**Screenshots (6 required):**
- [ ] `proof_01_login_page.png`
- [ ] `proof_02_registration_page.png` 
- [ ] `proof_03_dashboard.png`
- [ ] `proof_09_monitor_creation_form.png`
- [ ] `proof_10_dashboard_with_monitors.png`
- [ ] `proof_11_monitor_details.png`

**API Response Files (9 required):**
- [ ] `proof_04_registration_api.txt`
- [ ] `proof_05_login_api.txt`
- [ ] `proof_06_ai_classification.txt`
- [ ] `proof_07_monitor_list.txt`
- [ ] `proof_08_ai_evaluation.txt`
- [ ] `proof_12_system_health.txt`
- [ ] `proof_13_ai_direct_test.txt`
- [ ] `proof_14_ai_fallback_test.txt`
- [ ] `proof_15_performance_timing.txt`

## REALISTIC EXPECTATIONS

**✅ What SHOULD Work:**
- User registration and login
- Basic monitor creation via API
- AI classification with 70%+ accuracy for clear prompts
- Dashboard displaying created monitors
- Basic error handling and fallbacks

**⚠️ What Might Need Debugging:**
- Complex AI prompts may need refinement
- AI provider response times may vary
- Some edge cases might require manual handling
- Performance may be slower during initial testing

**❌ Immediate Escalation Triggers:**
- Server not responding at all
- Database connection failures
- AI services completely non-functional
- Authentication system broken
- Build failures preventing app startup

## EMERGENCY CONTACTS

**Critical Issues:**
- **AI Services**: `ai_sonnet_003` - <30 minute response
- **Backend APIs**: `be_primary_001_23f6` - <15 minute response  
- **Frontend**: `fe_primary_001_k8m3` - <30 minute response
- **Infrastructure**: `ld_primary_001_h3n8` - <30 minute response

**FINAL NOTE**: This is not about perfect functionality - it's about proving the core system works as claimed. Focus on demonstrating real functionality with screenshots and API responses, even if some features need refinement.

**The Ferrari doesn't need to be perfect - it just needs to actually drive.** 🏎️