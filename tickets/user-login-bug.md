# User Login Bug

Users are unable to log in when their username contains special characters like @, +, or spaces.

## Steps to Reproduce
1. Try to log in with username "user@company.com"
2. Enter correct password
3. Login fails with "Invalid credentials" error

## Expected Behavior
Users should be able to log in with any valid username format.

## Priority
High - blocking user access