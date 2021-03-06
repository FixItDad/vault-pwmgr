#!/usr/bin/python

# Functional tests for the initial password login page.

# Currently targeting Firefox
# Depends on the vault configuration provided by the startdev.sh script. 
# TODO: configure vault data from pretest fixture.

import pytest
import time

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Test vault-pwmgr server to point to for tests
PWMGR_URL = "http://127.0.0.1:7080/"


# Log in with the supplied credentials
def login(driver, userid, userpw):
    loginid = driver.find_element_by_id("loginid")
    loginid.clear()
    loginid.send_keys(userid)

    loginpw = driver.find_element_by_id("loginpw")
    loginpw.clear()
    loginpw.send_keys(userpw)

    loginpw.submit()
    

@pytest.fixture(scope="module")
def webdriver_object():
    # Create a new instance of the browser driver
    driver = webdriver.Firefox()
    yield driver
    driver.quit()

@pytest.fixture
def driver(webdriver_object):
    # Browse to the login page URL to start fresh
    webdriver_object.get(PWMGR_URL)
    WebDriverWait(webdriver_object, 10).until(EC.title_contains("Vault Password Manager"))
    return webdriver_object

def test_expected_fields(driver):
    # Verify that expected fields are shown
    loginid = driver.find_element_by_id("loginid")
    assert loginid
    assert loginid.tagname == "input"
    assert loginid.is_displayed()
    assert loginid.is_enabled()

    loginpw = driver.find_element_by_id("loginpw")
    assert loginpw
    assert loginpw.tagname == "input"
    assert loginpw.is_displayed()
    assert loginpw.is_enabled()
    assert loginpw.get_attribute("type") == "password"

    loginmsg = driver.find_element_by_id("loginmsg")
    assert loginmsg
    assert loginmsg.is_displayed()
    assert loginmsg.text == ""


def test_login_bad_id(driver):
    # Verify error message for bad username
    login(driver,'bozo','iMaCl0wn')
    loginid = driver.find_element_by_id("loginid")
    assert loginid
    loginmsg = driver.find_element_by_id("loginmsg")
    assert loginmsg
    assert loginmsg.is_displayed()
    assert loginmsg.text == "Bad Login information"

def test_login_bad_password(driver):
    # Verify error message for bad password
    login(driver,'user1','iMaCl0wn')
    loginid = driver.find_element_by_id("loginid")
    assert loginid
    loginmsg = driver.find_element_by_id("loginmsg")
    assert loginmsg
    assert loginmsg.is_displayed()
    assert loginmsg.text == "Bad Login information"

def test_login_success(driver):
    # Verify page change for success
    login(driver,'user1','user1pw')
    WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.ID,"entrydetails")))
    detail = driver.find_element_by_id("entrydetails")
    assert detail.is_displayed()
    detail = driver.find_element_by_tag_name("nav")
    assert detail

