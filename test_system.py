#!/usr/bin/env python3
"""
IG-Shop-Agent V2 System Test
Quick test script to verify all components work
"""
import sys
import os
import sqlite3

def test_dependencies():
    """Test if all required dependencies are available"""
    print("🔍 Testing Dependencies...")
    
    try:
        import fastapi
        print(f"✅ FastAPI: {fastapi.__version__}")
    except ImportError:
        print("❌ FastAPI not installed")
        return False
    
    try:
        import uvicorn
        print(f"✅ Uvicorn: {uvicorn.__version__}")
    except ImportError:
        print("❌ Uvicorn not installed")
        return False
    
    try:
        import sqlalchemy
        print(f"✅ SQLAlchemy: {sqlalchemy.__version__}")
    except ImportError:
        print("❌ SQLAlchemy not installed")
        return False
    
    try:
        import openai
        print(f"✅ OpenAI: {openai.__version__}")
    except ImportError:
        print("❌ OpenAI not installed")
        return False
    
    try:
        import httpx
        print(f"✅ HTTPX: {httpx.__version__}")
    except ImportError:
        print("❌ HTTPX not installed")
        return False
    
    return True

def test_database():
    """Test SQLite database creation"""
    print("\n🗄️ Testing Database...")
    
    try:
        # Test SQLite connection
        conn = sqlite3.connect(':memory:')
        cursor = conn.cursor()
        cursor.execute("SELECT sqlite_version()")
        version = cursor.fetchone()[0]
        print(f"✅ SQLite: {version}")
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Database error: {e}")
        return False

def test_environment():
    """Test environment configuration"""
    print("\n🔧 Testing Environment...")
    
    # Check .env file
    env_file = ".env"
    if os.path.exists(env_file):
        print("✅ .env file found")
        
        # Read and verify key settings
        with open(env_file, 'r') as f:
            content = f.read()
            
        if "OPENAI_API_KEY" in content:
            print("✅ OpenAI API Key configured")
        else:
            print("⚠️ OpenAI API Key not configured")
            
        if "META_APP_ID" in content:
            print("✅ Meta App ID configured")
        else:
            print("⚠️ Meta App ID not configured")
            
        return True
    else:
        print("❌ .env file not found")
        return False

def test_api_structure():
    """Test API file structure"""
    print("\n📁 Testing API Structure...")
    
    required_files = [
        "backend/main.py",
        "backend/app/core/config.py",
        "backend/app/core/database.py",
        "backend/app/models/merchant.py",
        "backend/app/api/health.py",
        "backend/app/api/auth.py",
        "backend/app/api/webhooks.py",
        "backend/app/api/merchants.py",
        "backend/app/services/ai_service.py",
        "backend/app/services/instagram_service.py"
    ]
    
    all_exist = True
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"✅ {file_path}")
        else:
            print(f"❌ {file_path}")
            all_exist = False
    
    return all_exist

def test_imports():
    """Test if backend imports work"""
    print("\n📦 Testing Backend Imports...")
    
    # Add backend to Python path
    sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
    
    try:
        from app.core.config import settings
        print(f"✅ Config loaded: {settings.APP_NAME}")
    except Exception as e:
        print(f"❌ Config import error: {e}")
        return False
    
    try:
        from app.models.merchant import Merchant
        print("✅ Merchant model imported")
    except Exception as e:
        print(f"❌ Merchant import error: {e}")
        return False
    
    try:
        from app.api.health import health_router
        print("✅ Health router imported")
    except Exception as e:
        print(f"❌ Health router import error: {e}")
        return False
    
    return True

def create_demo_data():
    """Create demo database with test data"""
    print("\n🎭 Creating Demo Data...")
    
    try:
        sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
        from app.core.database import create_tables
        
        create_tables()
        print("✅ Demo database created with sample merchant")
        return True
    except Exception as e:
        print(f"❌ Demo data creation error: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 IG-Shop-Agent V2 System Test")
    print("=" * 50)
    
    tests = [
        ("Dependencies", test_dependencies),
        ("Database", test_database), 
        ("Environment", test_environment),
        ("API Structure", test_api_structure),
        ("Backend Imports", test_imports),
        ("Demo Data", create_demo_data)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name} PASSED")
            else:
                print(f"❌ {test_name} FAILED")
        except Exception as e:
            print(f"❌ {test_name} ERROR: {e}")
    
    print(f"\n{'='*50}")
    print(f"🎯 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! V2 system is ready.")
        print("\n📋 Next Steps:")
        print("1. Run: cd backend")
        print("2. Run: python main.py")
        print("3. Open: http://localhost:8000/docs")
        print("4. Test: Open frontend/index.html in browser")
    else:
        print("⚠️ Some tests failed. Please fix issues before running.")

if __name__ == "__main__":
    main() 