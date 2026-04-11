dept_codes = {
    "AIML": 148,
    "IT": 205,
}

RESULT_STATES = (
    "PROVISIONAL",
    "REVAL",
    "CHALLENGE",
)

RESULT_GRADES = (
    "O",
    "A+",
    "A",
    "B+",
    "B",
    "C",
    "U",
    "UA",
    "NC",
)

subject_credit_mapping = {
    # Sem 7 subjects
    "GE3791": 2,
    "AI3021": 3,
    "CCS355": 3,
    "CCS374": 3,
    "GE3752": 3,
    "IT3711": 3,
    "OHS352": 3,
    "SB8067": 3,
    # Sem 6 subjects
    "CCS356": 4,
    "CCS370": 3,
    "CCS336": 3,
    "CCW332": 3,
    "CCS372": 3,
    "IT3681": 1.5,
    "MX3085": 0,  # Non credit course
    "NM1067": 2,  # Naan Mudhalvan (currently disabled)
    # Sem 5 subjects
    "CS3591": 4,
    "IT3501": 3,
    "CS3551": 3,
    "CS3691": 4,
    "CCS334": 3,
    "CCS335": 3,
    # honor courses disabled for now
    "CCS366": 0,
    "CCS360": 0,
    # ----
    "MX3084": 0,  # Non credit course
    "IT3511": 2,
    "NM1120": 2,  # 2 credits (currently disabled)
    # Sem 4 subjects
    "CS3451": 3,
    "CS3452": 3,
    "CS3461": 1.5,
    "CS3481": 1.5,
    "CS3491": 4,
    "CS3492": 3,
    "GE3451": 2,
    "IT3401": 4,
    # Disable the naan mudhalvan by setting credits to 0
    "NM1075": 2,  # 2 credits (currently disabled)
    "MA3354": 4,
    "CS3351": 4,
    "CS3352": 3,
    "CD3291": 3,
    "CS3391": 3,
    "CD3281": 2,
    "CS3381": 1.5,
    "CS3361": 2,
    "GE3361": 1,
    "NM1113": 0,  # 2 credits (currently disabled)
    # Sem 2 subjects
    "HS3252": 2,
    "MA3251": 4,
    "PH3256": 3,
    "BE3251": 3,
    "GE3251": 4,
    "CS3251": 3,
    "GE3252": 1,
    "CS3271": 2,
    "GE3271": 2,
    "GE3272": 2,
    # Sem 1 Subjects
    "MA3151": 4,
    "PH3151": 3,
    "CY3151": 3,
    "GE3151": 3,
    "GE3152": 1,
    "GE3171": 2,
    "BS3171": 2,
    "GE3172": 1,
    "HS3152": 3,
}

subject_sem_mapping = {
    # Sem 7 subjects
    "GE3791": 7,
    "AI3021": 7,
    "CCS355": 7,
    "CCS374": 7,
    "GE3752": 7,
    "IT3711": 7,
    "OHS352": 7,
    "SB8067": 7,
    # Sem 6 subjects
    "CCS356": 6,
    "CCS370": 6,
    "CCS336": 6,
    "CCW332": 6,
    "CCS372": 6,
    "IT3681": 6,
    "MX3085": 6,
    "NM1067": 6,
    # Sem 5 subjects
    "CS3591": 5,
    "IT3501": 5,
    "CS3551": 5,
    "CS3691": 5,
    "CCS334": 5,
    "CCS335": 5,
    "CCS366": 5,
    "CCS360": 5,
    "MX3084": 5,
    "IT3511": 5,
    "NM1120": 5,
    # Sem 4 subjects
    "CS3451": 4,
    "CS3452": 4,
    "CS3491": 4,
    "CS3492": 4,
    "GE3451": 4,
    "IT3401": 4,
    "CS3481": 4,
    "CS3461": 4,
    "NM1075": 4,
    # Sem 3 subjects
    "CS3351": 3,
    "CS3352": 3,
    "MA3354": 3,
    "CD3291": 3,
    "CS3391": 3,
    "CD3281": 3,
    "CS3381": 3,
    "CS3361": 3,
    "GE3361": 3,
    "NM1113": 3,  # 2 credits (currently disabled)
    # Sem 2 subjects
    "HS3252": 2,
    "MA3251": 2,
    "PH3256": 2,
    "BE3251": 2,
    "GE3251": 2,
    "CS3251": 2,
    "GE3252": 2,
    "CS3271": 2,
    "GE3271": 2,
    "GE3272": 2,
    # Sem 1 Subjects
    "MA3151": 1,
    "PH3151": 1,
    "CY3151": 1,
    "GE3151": 1,
    "HS3152": 1,
    "GE3152": 1,
    "GE3171": 1,
    "BS3171": 1,
    "GE3172": 1,
}

subject_name_mapping = {
    # Sem 7 subjects
    "GE3791": "Ethics and Human Values",
    "AI3021": "IT in Agriculture",
    "CCS355": "Neural Network and Deep Learning",
    "CCS374": "Web Application Security",
    "GE3752": "Total Quality Management",
    "IT3711": "Summer Internship",
    "OHS352": "Project Report Writing",
    "SB8067": "Salesforce Developer",
    # Sem 6 subjects
    "CCS356": "Object Oriented Software Engineering",
    "CCS370": "UI & UX Design",
    "CCS336": "Cloud Service Management",
    "CCW332": "Digital Marketing",
    "CCS372": "Virtualization",
    "IT3681": "Mobile Application Development Laboratory",
    "MX3085": "Well Being with Yoga",
    "NM1067": "Naan Mudhalvan",
    # Sem 5 subjects
    "CS3591": "Computer Networks",
    "IT3501": "Full Stack Web Development",
    "CS3551": "Distributed Computing",
    "CS3691": "Embedded Systems and IoT",
    "CCS334": "Big Data Analytics",
    "CCS335": "Cloud Computing",
    "CCS366": "Software Testing and Automation",
    "CCS360": "Recomender Systems",
    "MX3084": "Disaster Risk Reduction and Management",
    "IT3511": "Full Stack Web Development Lab",
    "NM1120": "Naan Mudhalvan",
    # Sem 4 subjects
    "CS3451": "Introduction to Operating Systems",
    "CS3452": "Theory of Computation",
    "CS3491": "Artificial Intelligence and Machine Learning",
    "CS3492": "Database Management Systems",
    "GE3451": "Environmental Science and Sustainability",
    "IT3401": "Web Essentials",
    "CS3461": "Operating Systems Lab",
    "CS3481": "Database Management Systems Lab",
    "NM1075": "Naan Mudhalvan",
    # Sem 3 subjects
    "CS3351": "Digital Principles and Computer Organization",
    "CD3291": "Data Structures and Algorithm",
    "MA3354": "Discrete Mathematics",
    "CS3352": "Foundations of Data Science",
    "CS3391": "Object Oriented Programming",
    "CD3281": "Data Structures and Algorithm Lab",
    "CS3381": "Object Oriented Programming Lab",
    "CS3361": "Data Science Lab",
    # Sem 2 subjects
    "HS3252": "Professional English II",
    "MA3251": "Statistics and Numerical Methods",
    "PH3256": "Physics for Information Science",
    "BE3251": "Basic Electrical and Electronics Engineering",
    "GE3251": "Engineering Graphics",
    "CS3251": "Programming in C",
    "GE3252": "Tamils and Technology",
    "CS3271": "Programming in C Lab",
    "GE3271": "Engineering Practices Lab",
    "GE3272": "Communications Lab",
    # Sem 1 Subjects
    "MA3151": "Matrices and Calculus",
    "PH3151": "Engineering Physics I",
    "CY3151": "Engineering Chemistry I",
    "GE3151": "Problem Solving and Python Programming",
    "HS3152": "Professional English I",
    "GE3152": "Heritage of Tamils",
    "GE3171": "Problem Solving and Python Programming Lab",
    "BS3171": "Physics and Chemistry Lab",
    "GE3172": "English Lab",
}


grade_mapping = {
    "O": 10,
    "A+": 9,
    "A": 8,
    "B+": 7,
    "B": 6,
    "C": 5,
    "U": 0,  # Reappear
    "UA": 0,  # Arrear Absent
    "NC": 0,  # No Change (audit event, ignored for effective override)
    "NA": 0,  # Not Available
}


def calculate_sgpa(semester: int, grades: dict, all_subs: bool = False) -> float:
    if not (1 <= semester <= 8):
        raise ValueError("Semester must be between 1 and 8 inclusive.")

    # get subjects from semester_mapping
    subjects = (
        [
            sub for sub, res in grades.items() if res != "NA"
        ]  # ignore subjects with NA grade (Not Available)
        if not all_subs
        else [sub for sub, sem in subject_sem_mapping.items() if sem == semester]
    )
    print(subjects)
    credits = [subject_credit_mapping[sub] for sub in subjects]

    gps = []
    for subject in subjects:
        grade = grades.get(subject, "U")
        gp = grade_mapping[grade]
        gps.append(gp * credits[subjects.index(subject)])

    total_credits = sum(credits)
    total_gp = sum(gps)

    return total_gp / total_credits


def get_subjects_for_semester(semester: int) -> list[str]:
    return [sub for sub, sem in subject_sem_mapping.items() if sem == semester]


def get_subject_name(subject_code: str, short_name: bool = False) -> str:
    name = subject_name_mapping.get(subject_code, "Unknown Subject")
    # take the first letter of each word in the subject name to create a short name
    return (
        name
        if not short_name
        else "".join(word[0] for word in name.split() if word[0].isupper())
    )
