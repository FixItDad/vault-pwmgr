#!/usr/bin/python

# Functional tests for the main password manager page

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
    login(webdriver_object,'psparks','pw')
    WebDriverWait(webdriver_object, 10).until(EC.presence_of_element_located((By.ID,"entrydetails")))
    time.sleep(0.5)
    return webdriver_object


class NavCheck():
    def __init__(s,driver):
        s.driver = driver
        s.nav = driver.find_element_by_tag_name("nav")
        assert s.nav
        
    def collection(s, name):
        """ Return a collection webelement by name or None if not found """
        for element in s.nav.find_elements_by_class_name("collectionname"):
            if element.text == name:
                return element.parent
        return None

    def collectionname(s, name):
        """ Return a collection webelement by name or None if not found """
        for element in s.nav.find_elements_by_class_name("collectionname"):
            if element.text == name:
                return element
        return None

    def collections(s):
        """ Return a dictionary of collectionname_webelement:collection_webelement pairs. 
        Returns empty dictionary if none found.
        """
        retval = {}
        for element in collection.find_element_by_class_name("collectionname"):
            retval[element] = element.parent
        return retval

    def group(s, collection, name):
        """ Return a group webelement by name or None if not found """
        for element in collection.find_elements_by_class_name("groupname"):
            if element.text == name:
                return element.parent
        return None

    def groupname(s, collection, name):
        """ Return a group webelement by name or None if not found """
        for element in collection.find_elements_by_class_name("groupname"):
            print "Checking group name", element.text
            if element.text == name:
                return element
        return None

    def groups(s, collection):
        """ Return a dictionary of groupname_webelement:group_webelement pairs. 
        Returns empty dictionary if none found.
        """
        retval = {}
        for element in collection.find_elements_by_class("groupname"):
            retval[element] = element.parent
        return retval

    def item(s, group, name):
        for element in group.find_elements_by_class_name("itemname"):
            if element.text == name:
                return element
        return None
        
    def items(s, group):
        """ Return a list of itemname_webelements. Empty list if none found. """
        return group.find_elements_by_class_name("itemname")

    def _click(s, element):
        # Reload nav tree after clicking an element
        element.click()
        time.sleep(0.5)
        s.nav = s.driver.find_element_by_tag_name("nav")

    def click(s, path):
        """ Generate a click on a navigation tree element """
        assert len(path) > 0 and len(path) < 4

        collection = s.collectionname(path[0])
        assert collection
        if len(path) == 1:
            s._click(collection)
            return

        group = s.groupname(collection.parent, path[1])
        assert group
        if len(path) == 2:
            s._click(group)
            return

        item = s.item(group.parent, path[2])
        assert item
        s._click(item)
        return


    def visible(s, path):
        """ Returns True if an item is visible in the nav tree """
        assert len(path) > 0 and len(path) < 4
        print "Looking for ",path
        collection = s.collectionname(path[0])
        if not collection: return False
        print "Found collection", collection.text
        if len(path) == 1:
            return collection.is_displayed()

        group = s.groupname(collection.parent, path[1])
        if not group: return False
        print "Found group", group.text
        if len(path) == 2:
            return group.is_displayed()

        item = s.item(group.parent, path[2])
        if not item: return False
        return item.is_displayed()

        
    def hidden(s, path):
        """ Return True if an item is not visible in the nav tree """
        assert len(path) > 0 and len(path) < 4

        collection = s.collectionname(path[0])
        if not collection: return True
        if len(path) == 1:
            return not collection.is_displayed()

        group = s.groupname(collection.parent, path[1])
        if not group: return True
        if len(path) == 2:
            return not group.is_displayed()

        item = s.item(group.parent, path[2])
        if not item: return True
        return not item.is_displayed()
        


def test_navigation_visibility(driver):
    # Verify that expected navigation elements are visible. Expand tree to reveal all.

    # Check for elements in the nav tree there are 3 level: collection, group, item
    nav = NavCheck(driver)

    # initiallt only collection names are visible
    assert nav.visible(["psparks"])
    assert nav.visible(["linuxadmin"])
    # group names
    assert nav.hidden(["psparks","Pauls Stuff/"])
    assert nav.hidden(["psparks","web/"])
    assert nav.hidden(["linuxadmin","webservers/"])
    # Items
    assert nav.hidden(["psparks","Pauls Stuff/","$+dream"])
    assert nav.hidden(["psparks","web/","google"])
    assert nav.hidden(["psparks","web/","netflix"])
    assert nav.hidden(["linuxadmin","webservers/","LoadBal"])
    assert nav.hidden(["linuxadmin","webservers/","extA"])
    assert nav.hidden(["linuxadmin","webservers/","extB"])

    # open a collection, groups in the collection are visible
    nav.click(["linuxadmin"])
    assert nav.visible(["linuxadmin","webservers/"])
    assert nav.hidden(["psparks","Pauls Stuff/"])
    assert nav.hidden(["psparks","web/"])

    # open other collection. All groups visible
    nav.click(["psparks"])
    assert nav.visible(["linuxadmin","webservers/"])
    assert nav.visible(["psparks","Pauls Stuff/"])
    assert nav.visible(["psparks","web/"])

    # open a group. Group items are visible
    nav.click(["psparks","web/"])
    assert nav.visible(["psparks","web/","google"])
    assert nav.visible(["psparks","web/","netflix"])
    assert nav.hidden(["psparks","Pauls Stuff/","$+dream"])
    assert nav.hidden(["linuxadmin","webservers/","LoadBal"])
    assert nav.hidden(["linuxadmin","webservers/","extA"])
    assert nav.hidden(["linuxadmin","webservers/","extB"])

    # Close a group and open another
    nav.click(["psparks","web/"])
    nav.click(["linuxadmin","webservers/"])
    assert nav.hidden(["psparks","Pauls Stuff/","$+dream"])
    assert nav.visible(["linuxadmin","webservers/","LoadBal"])
    assert nav.visible(["linuxadmin","webservers/","extA"])
    assert nav.visible(["linuxadmin","webservers/","extB"])
    assert nav.hidden(["psparks","web/","google"])
    assert nav.hidden(["psparks","web/","netflix"])

    #open the last group
    nav.click(["psparks","Pauls Stuff/"])
    assert nav.visible(["psparks","Pauls Stuff/","$+dream"])

    # close a collection, all groups and items in the collection are hidden
    nav.click(["linuxadmin"])
    assert nav.hidden(["linuxadmin","webservers/"])
    assert nav.hidden(["linuxadmin","webservers/","LoadBal"])
    assert nav.hidden(["linuxadmin","webservers/","extA"])
    assert nav.hidden(["linuxadmin","webservers/","extB"])
    
