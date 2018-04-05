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


def _login_pw(driver, userid, userpw):
    """ Helper routine to log in by password with the supplied credentials. """
    loginid = driver.find_element_by_id("loginid")
    loginid.clear()
    loginid.send_keys(userid)

    loginpw = driver.find_element_by_id("loginpw")
    loginpw.clear()
    loginpw.send_keys(userpw)

    loginpw.submit()
    

@pytest.fixture(scope="module")
def webdriver_module():
    # Create a new instance of the browser driver at the module level
    driver = webdriver.Firefox()
    yield driver
    driver.quit()

@pytest.fixture
def driver(webdriver_module):
    # Set up the initial webdirver state for functions in this module.
    # These functions test post login functionality, so start with a
    # fresh login page and enter test user credentials.
    webdriver_module.get(PWMGR_URL)
    WebDriverWait(webdriver_module, 10).until(EC.title_contains("Vault Password Manager"))
    _login_pw(webdriver_module,'user1','user1pw')
    WebDriverWait(webdriver_module, 10).until(EC.presence_of_element_located((By.ID,"entrydetails")))
    WebDriverWait(webdriver_module, 10).until(EC.presence_of_element_located((By.TAG_NAME,"nav")))
    return webdriver_module


class ItemHelper():
    """ 
    Helper class for examining and manipulating the item form
    """
    def __init__(s,driver):
        """ Expects a Selenium style web browser driver """
        s.driver = driver
        s.form = driver.find_element_by_id("itemform")
        assert s.form is not None

    # The valid key values for item dictionaries
    FIELD_NAMES = ("groupid","notes","password","title","url","userid",)

    def set_fields(s, itemdict):
        """ Fill item fields with values from itemdict. Keys must match
        values from FIELD_NAMES. Non-matching fields are ignored. """
        for field in s.FIELD_NAMES:
            if field not in itemdict: continue
            element = s.form.find_element_by_id(field)
            element.send_keys(itemdict(field))

    def get_fields(s):
        """ Return a dictionary with current form field values. """
        vals = {}
        for field in s.FIELD_NAMES:
            element = s.form.find_element_by_id(field)
            vals[field] = element.text
        return vals

    fields = property(get_fields, set_fields)

    @property
    def message(s):
        return s.form.find_element_by_id("mainmsg").text

    def add_new(s):
        """ Clicks the Add New button """
        s.form.find_element_by_id("b-new").click()


class NavigationHelper():
    """ 
    Helper class for examining and manipulating the navigation tree of 
    collections, groups and items.
    """
    def __init__(s,driver):
        """ Expects a Selenium style web browser driver """
        s.driver = driver
        s.nav = driver.find_element_by_tag_name("nav")
        assert s.nav
        
    def collection(s, name):
        """ Return a collection webelement by name or None if not found """
        for element in s.nav.find_elements_by_class_name("collectionname"):
            if element.text == name:
                return element.find_element_by_xpath('..')
        return None

    def collectionname(s, name):
        """ Return a collection webelement by name or None if not found.
        The collection element is the parent of the collectionname element
        """
        for element in s.nav.find_elements_by_class_name("collectionname"):
            if element.text == name:
                return element
        return None

    def collections(s):
        """ Return a dictionary of collectionname_webelement:collection_webelement pairs. 
        Returns empty dictionary if none found.
        """
        retval = {}
        for element in s.nav.find_elements_by_class_name("collectionname"):
            retval[element] = element.find_element_by_xpath('..')
        return retval

    def group(s, collection, name):
        """ Return a group webelement by name or None if not found """
        for element in collection.find_elements_by_class_name("groupname"):
            if element.text == name:
                return element.find_element_by_xpath('..')
        return None

    def groupname(s, collection, name):
        """ Return a group webelement by name or None if not found.
        The group element is the parent of the groupname element.
        """
        for element in collection.find_elements_by_class_name("groupname"):
            if element.text == name:
                return element
        return None

    def groups(s, collection):
        """ Return a dictionary of groupname_webelement:group_webelement pairs. 
        Returns empty dictionary if none found. collection is the containing webelement. 
        """
        retval = {}
        for element in collection.find_elements_by_class_name("groupname"):
            retval[element] = element.find_element_by_xpath('..')
        return retval

    def item(s, group, name):
        """ Return an item web element by name or None if not found. 
        Unlike groupname and collectionname, itemname elements are not contained
        by an item element. group is the containing webelement. 
        """
        for element in group.find_elements_by_class_name("itemname"):
            if element.text == name:
                return element
        return None
        
    def items(s, group):
        """ Return a list of itemname_webelements. Empty list if none found. group is
        the containing webelement. """
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

        group = s.groupname(collection.find_element_by_xpath('..'), path[1])
        assert group
        if len(path) == 2:
            s._click(group)
            return

        item = s.item(group.find_element_by_xpath('..'), path[2])
        assert item
        s._click(item)
        return

    def visiblelist(s):
        """ Returns a sorted list of tuples in the nav tree that are currently visible.
        The tuples can be of the form ("collection",), ("collection", "group"), or
        ("collection", "group", "item"). No expansion of the tree items is done. 
        """
        visible = []
        collectionmap = s.collections()
        assert len(collectionmap) > 0
        for cname in collectionmap.keys():
            collection_expanded = False
            groups = s.groups(collectionmap[cname])
            for groupname in groups.keys():
                group_expanded = False
                items = s.items(groups[groupname])
                for item in items:
                    if item.is_displayed():
                        visible.append( (cname.text, groupname.text, item.text) )
                        collection_expanded = True
                        group_expanded = True
                if groupname.is_displayed() and not group_expanded:
                    visible.append( (cname.text, groupname.text) )
                    collection_expanded = True
            if not collection_expanded:
                visible.append( (cname.text,) )
        return sorted(visible)


    def visible(s, path):
        """ Returns True if an item is visible in the nav tree """
        assert len(path) > 0 and len(path) < 4
        print "Looking for ",path
        collection = s.collectionname(path[0])
        if not collection: return False
        print "Found collection", collection.text
        if len(path) == 1:
            return collection.is_displayed()

        group = s.groupname(collection.find_element_by_xpath('..'), path[1])
        if not group: return False
        print "Found group", group.text
        if len(path) == 2:
            return group.is_displayed()

        item = s.item(group.find_element_by_xpath('..'), path[2])
        if not item: return False
        return item.is_displayed()

        
    def hidden(s, path):
        """ Return True if an item is not visible in the nav tree """
        # Vue does not fully build the nav tree immediately, so we must allow for
        # elements to be missing in addition to being present but not displayed.
        assert len(path) > 0 and len(path) < 4

        collection = s.collectionname(path[0])
        if not collection: return True
        if len(path) == 1:
            return not collection.is_displayed()

        group = s.groupname(collection.find_element_by_xpath('..'), path[1])
        if not group: return True
        if len(path) == 2:
            return not group.is_displayed()

        item = s.item(group.find_element_by_xpath('..'), path[2])
        if not item: return True
        return not item.is_displayed()


def ztest_navigation_visibility(driver):
    """ 
    Requirement: All authorized items should be reachable from the nav tree.
    Requirement: Nav tree initially shows only collection names.
    Gradually expand tree to reveal all 3 levels: collection, group, item
    """        
    nav = NavigationHelper(driver)

    # initially only collection names are visible
    visible = nav.visiblelist()
    assert visible == [('linuxadmin',), ('user1',)]

    # open a collection, groups in the collection should be visible
    nav.click(["linuxadmin"])
    visible = nav.visiblelist()
    assert visible == [
        ('linuxadmin','webservers/'),
        ('user1',),
    ]

    # open other collection. All groups visible
    nav.click(["user1"])
    visible = nav.visiblelist()
    assert visible == [
        ('linuxadmin','webservers/'),
        ('user1','Pauls Stuff/'),
        ('user1','network/'),
        ('user1','web/'),
    ]

    # open a group. Group items are visible
    nav.click(["user1","web/"])
    visible = nav.visiblelist()
    assert visible == [
        ('linuxadmin','webservers/'),
        ('user1','Pauls Stuff/'),
        ('user1','network/'),
        ('user1','web/', 'google'),
        ('user1','web/', 'netflix'),
    ]

    # Close a group and open another
    nav.click(["user1","web/"])
    nav.click(["linuxadmin","webservers/"])
    visible = nav.visiblelist()
    assert visible == [
        ('linuxadmin','webservers/','LoadBal'),
        ('linuxadmin','webservers/','extA'),
        ('linuxadmin','webservers/','extB'),
        ('user1','Pauls Stuff/'),
        ('user1','network/'),
        ('user1','web/'),
    ]

    #open the last group
    nav.click(["user1","Pauls Stuff/"])
    visible = nav.visiblelist()
    assert visible == [
        ('linuxadmin','webservers/','LoadBal'),
        ('linuxadmin','webservers/','extA'),
        ('linuxadmin','webservers/','extB'),
        ('user1','Pauls Stuff/','$+dream'),
        ('user1','network/'),
        ('user1','web/'),
    ]

    # close a collection, all groups and items in the collection are hidden
    nav.click(["linuxadmin"])
    visible = nav.visiblelist()
    assert visible == [
        ('linuxadmin',),
        ('user1','Pauls Stuff/','$+dream'),
        ('user1','network/'),
        ('user1','web/'),
    ]
    

def test_add_item_from_blank(driver):
    """  """
    nav = NavigationHelper(driver)
    form = ItemHelper(driver)

    # initially only collection names are visible
    visible = nav.visiblelist()
    assert visible == [('linuxadmin',), ('user1',),]

    assert form.fields == {
        "groupid":"","notes":"","password":"","title":"","url":"","userid":"",
    }
    form.fields = {
        "groupid":"web",
        "title":"Facebook",
        "url":"https://facebook.com",
        "userid":"bob",
        "password":"bobknows",
        "notes":"Forget privacy!",
    }
    form.add_new()

    assert form.message == "Added new entry web/Facebook"

    # visible in nav tree?
    nav.click(["user1"])
    nav.click(["user1","web/"])
    visible = nav.visiblelist()
    assert visible == [
        ('user1','Pauls Stuff/'),
        ('user1','network/'),
        ('user1','web/', 'Facebook'),
        ('user1','web/', 'google'),
        ('user1','web/', 'netflix'),
    ]

    assert False, 'not implemented'

def ztest_delete_item(driver):
    """  """
    assert False, 'not implemented'

def ztest_modify_item_group(driver):
    """  """
    assert False, 'not implemented'

def ztest_modify_item_notes(driver):
    """  """
    assert False, 'not implemented'

def ztest_modify_item_password(driver):
    """  """
    assert False, 'not implemented'

def ztest_modify_item_title(driver):
    """  """
    assert False, 'not implemented'

def ztest_modify_item_url(driver):
    """  """
    assert False, 'not implemented'

def ztest_modify_item_userid(driver):
    """  """
    assert False, 'not implemented'

def ztest_clear_item_fields(driver):
    """  """
    assert False, 'not implemented'

def ztest_shared_item_visibility(driver):
    """  """
    assert False, 'not implemented'

