#!/usr/bin/python

# Helper classes for tests.

import datetime
import time

from selenium.webdriver.support.select import Select

""" Name of the archive group. """
HISTGROUP = u'Archive/'



class ItemHelper(object):
    """ 
    Helper class for examining and manipulating the item form
    """
    def __init__(s,driver):
        """ Expects a Selenium style web browser driver """
        s.driver = driver
        s.form = driver.find_element_by_id("itemform")
        assert s.form is not None

    # The valid key values for item dictionaries
    TEXT_FIELDS = ("groupid","notes","password","title","url","userid",)
    SEL_FIELDS = ("collectionid",)
    
    def set_fields(s, itemdict):
        """ Fill item fields with values from itemdict. Keys must match
        values from TEXT_FIELDS. Non-matching fields are ignored. """
        for field in s.TEXT_FIELDS:
            if field not in itemdict: continue
            element = s.form.find_element_by_id(field)
            element.send_keys(itemdict[field])
        for field in s.SEL_FIELDS:
            if field not in itemdict: continue
            element = Select(s.form.find_element_by_id(field))
            element.select_by_visible_text(itemdict[field])

    def get_fields(s):
        """ Return a dictionary with current form field values. """
        vals = {}
        for field in s.TEXT_FIELDS:
            element = s.form.find_element_by_id(field)
            vals[field] = element.get_attribute("value")
        for field in s.SEL_FIELDS:
            element = Select(s.form.find_element_by_id(field))
            vals[field] = element.first_selected_option.text
        return vals

    fields = property(get_fields, set_fields)

    @property
    def message(s):
        return s.form.find_element_by_id("mainmsg").text

    def add_new(s):
        """ Clicks the Add New button """
        s.form.find_element_by_id("b-new").click()

    def delete(s):
        """ Clicks the Delete button then OKs the 'Are you sure?' dialog. 
        A WebDriverWait is recommended after calling this function.
        """
        s.form.find_element_by_id("b-delete").click()
        s.driver.switch_to.alert.accept()

class NavigationHelper(object):
    """ 
    Helper class for examining and manipulating the navigation tree of 
    collections, groups and items.
    The click, visiblelist, visible, and archived functions are most commonly used.
    """
    def __init__(s,driver):
        """ Expects a Selenium style web browser driver """
        s.driver = driver
        s.nav = driver.find_element_by_tag_name("nav")
        assert s.nav
        
    def findarchived(s, del_ts, path, limit=5):
        """ Returns the title of an item in the archive group that is within 'limit'
        seconds of the del_ts datetime value. None is returned if no matching item 
        is found. The path is the original (collection, group, title) tuple.
        This function is needed to allow for the difference in timestamps when the
        item is deleted and measured by the test program. It will prevent the test 
        case from failing intermittently if the clock values rollover between the
        timestamps.
        """
        prefix = "{1}|{2}|".format(*path)
        for item in s.items(s.group(s.collection(path[0]), HISTGROUP)):
            if item.text.startswith(prefix):
                ts_str = item.text[len(prefix):]
                item_ts = datetime.datetime.strptime(ts_str,'%Y%m%d%H%M%S')
                if (del_ts - item_ts).total_seconds() < limit:
                    return item.text
        return None

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

    def hidden(s, path):
        """ Return True if an item is not visible in the nav tree. The path
        is (collection, group, title) tuple. """
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

    def visible(s, path):
        """ Returns True if an item is visible in the nav tree. The path 
        is (collection, group, title) tuple. 
        """
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
        
    def _click(s, element):
        # Reload nav tree after clicking an element
        element.click()
        time.sleep(0.5)
        s.nav = s.driver.find_element_by_tag_name("nav")

